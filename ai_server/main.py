import re
import random
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import os
from pathlib import Path

from openai import OpenAI

import json

import uuid
from typing import Dict, Literal, Optional

from typing import List

# Optional vector store (Chroma) for long-term memory
try:
    import chromadb
    from chromadb.config import Settings
    _CHROMA_AVAILABLE = True
except Exception:
    _CHROMA_AVAILABLE = False

# ==========================
# Models
# ==========================
class Persona(BaseModel):
    role_type: Literal["GM", "PLAYER", "NPC", "ENEMY"]
    name: str
    traits: list[str] = []
    stats: dict = {}
    speech_style: str = ""
    goals: list[str] = []

class SessionState(BaseModel):
    story_core: dict
    plot_outline: list[dict]
    current_act: int
    history: list[str]
    personas: dict[str, Persona] = {}
    scene_intro_done: bool = False

# In-memory session cache (디스크 저장과 함께 사용)
sessions: Dict[str, SessionState] = {}

# ==========================
# Env & OpenAI client
# ==========================
load_dotenv(dotenv_path=Path(__file__).parent / ".env")
api_key = os.getenv("OPENAI_API_KEY")
MODEL_DEFAULT = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")  # ChatGPT UI에서는 4.1-mini가 4o-mini를 대체
MODEL_FALLBACK = os.getenv("OPENAI_MODEL_FALLBACK", "gpt-5 -mini")

client = OpenAI(api_key=api_key)

app = FastAPI()

# DEV flags
DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"
DEV_SESSION_ID: Optional[str] = None

# ==========================
# Memory / Embedding config
# ==========================
EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
CHROMA_DIR = os.getenv("CHROMA_DIR", str((Path(__file__).parent / "chroma").resolve()))
MEMORY_EVERY_N = int(os.getenv("MEMORY_EVERY_N", "6"))  # summarize every N history lines
MEMORY_TOP_K = int(os.getenv("MEMORY_TOP_K", "4"))      # retrieved notes for context

# Initialize Chroma client (optional)
if _CHROMA_AVAILABLE:
    try:
        chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
        memory_collection = chroma_client.get_or_create_collection("trpg_memories", metadata={"hnsw:space": "cosine"})
    except Exception:
        _CHROMA_AVAILABLE = False
        memory_collection = None
else:
    memory_collection = None

# ==========================
# Session persistence (JSON)
# ==========================
SESS_DIR = Path(__file__).parent / "sessions"
SESS_DIR.mkdir(parents=True, exist_ok=True)

def _sess_path(sid: str) -> Path:
    return SESS_DIR / f"{sid}.json"

def load_session(sid: str) -> Optional[SessionState]:
    p = _sess_path(sid)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        # pydantic이 중첩 모델을 복원할 수 있도록 변환
        if "personas" in data and isinstance(data["personas"], dict):
            data["personas"] = {
                k: Persona(**v) if not isinstance(v, Persona) else v
                for k, v in data["personas"].items()
            }
        return SessionState(**data)
    except Exception:
        return None

def save_session(sid: str, state: SessionState) -> None:
    payload = state.model_dump()
    _sess_path(sid).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

# ==========================
# Utility
# ==========================

def chat(messages: list[dict], model: Optional[str] = None, **kwargs):
    """OpenAI Chat API 래퍼. 기본 모델로 시도 후, 실패 시 Fallback."""
    m = model or MODEL_DEFAULT
    try:
        return client.chat.completions.create(
            model=m,
            messages=messages,
            **{"temperature": 0.7, **kwargs},
        )
    except Exception:
        if MODEL_FALLBACK and MODEL_FALLBACK != m:
            return client.chat.completions.create(
                model=MODEL_FALLBACK,
                messages=messages,
                **{"temperature": 0.7, **kwargs},
            )
        raise


def roll_dice(expr: str) -> tuple[int, str]:
    # Patterns: "2d6+1", "d20", "3d4-2"
    match = re.fullmatch(r"(\d*)d(\d+)([+-]\d+)?", expr)
    if not match:
        raise ValueError(f"Invalid dice expression: {expr}")
    count = int(match.group(1)) if match.group(1) else 1
    sides = int(match.group(2))
    modifier = int(match.group(3)) if match.group(3) else 0
    rolls = [random.randint(1, sides) for _ in range(count)]
    total = sum(rolls) + modifier
    detail = f"{rolls}{match.group(3) or ''} = {total}"
    return total, detail

# --- Helper: normalize model reply ---
def _normalize_reply(text: str) -> str:
    """Clean model output: strip role labels and accidental JSON wrappers."""
    t = (text or "").strip()
    # If model returned JSON with a `reply` field, unwrap it
    try:
        j = json.loads(t)
        if isinstance(j, dict) and "reply" in j:
            t = str(j.get("reply") or "")
    except Exception:
        pass
    # Remove leading role labels like "사회자:", "NPC:", etc.
    t = re.sub(r"^\s*(사회자|GM|NPC|ENEMY|플레이어)\s*[:：]\s*", "", t)
    return t


# --- Dice inference helpers -------------------------------------------------

def _extract_percent_target(text: str) -> Optional[int]:
    """Infer a percent target (1~100) from free-form text.
    Tries numbers in parentheses/brackets first, then near 판정/체크/검사 keywords.
    """
    if not text:
        return None
    # (35) or [35] or (35%) style
    m = re.search(r"[\(\[]\s*(\d{1,3})\s*%?\s*[\)\]]", text)
    if m:
        try:
            v = int(m.group(1))
            if 1 <= v <= 100:
                return v
        except Exception:
            pass
    # around keywords → first 1~100 number
    if re.search(r"(판정|체크|검사|check|roll)", text, re.IGNORECASE):
        m = re.search(r"(?:성공률|목표|수치|값)\s*(\d{1,3})", text)
        if m:
            try:
                v = int(m.group(1))
                if 1 <= v <= 100:
                    return v
            except Exception:
                pass
        m = re.search(r"\b(\d{1,3})\b", text)
        if m:
            try:
                v = int(m.group(1))
                if 1 <= v <= 100:
                    return v
            except Exception:
                pass
    return None


def _contextual_dice_expr(user_input: str, story_core: dict | None = None) -> Optional[str]:
    """Heuristically decide dice from situation keywords.
    - Combat/attack → d4/d6/d8
    - Mental/SAN/공포/의지 → d8/d10/d20
    - Physical/근력/지구력/달리기 등 → d10/d20
    Returns an expression like 'd6' (no count → 1 by default).
    """
    t = (user_input or "").lower()

    # Keyword buckets
    combat_light = ["단검","단도","주먹","펀치","소형","작은","경량"]
    combat_mid   = ["권총","칼","몽둥이","곤봉","사격","공격","격투","회피","타격","명중","전투"]
    combat_heavy = ["소총","샷건","대검","양손검","망치","대형","강타","치명","헤비"]

    mental_light = ["주의","집중","불안","긴장","의심","심리","설득","협상","관찰"]
    mental_core  = ["정신력","이성","san","의지","멘탈"]
    mental_heavy = ["공포","광기","정신붕괴","패닉","악몽"]

    physical_light = ["운전","민첩","균형","도약","회피","숨기","손재주"]
    physical_heavy = ["근력","힘","버티","들어올리","지구력","인내","수영","등반","철문","벽"]

    has = lambda keys: any(k in t for k in keys)

    # Combat
    if has(combat_light):
        return "d4"
    if has(combat_heavy):
        return "d8"
    if has(combat_mid):
        return "d6"

    # Mental
    if has(mental_heavy):
        return "d20"
    if has(mental_core):
        return "d10"
    if has(mental_light):
        return "d8"

    # Physical
    if has(physical_heavy):
        return "d20"
    if has(physical_light):
        return "d10"

    return None


def infer_roll_from_texts(user_input: str, character_hint: Optional[str] = None, story_core: dict | None = None) -> Optional[dict]:
    """Infer a dice result from free text.
    Priority:
      1) Explicit dice in user_input (e.g., 2d6+1)
      2) character_hint like 'd100' / '2d6+1' (ROLL override)
      3) Contextual heuristic by keywords (combat / mental / physical)
      4) Implicit percent check with target (e.g., '(35)') → d100 vs target
    Returns dict: {expr,total,detail[,target,success]}
    """
    # 1) explicit token in the message
    tokens = (user_input or "").strip().split()
    for tok in tokens:
        try:
            total, detail = roll_dice(tok)
            return {"expr": tok, "total": total, "detail": detail}
        except ValueError:
            continue

    # 2) hint as dice expression (for ROLL mode)
    if character_hint:
        hint = (character_hint or "").strip().lower()
        try:
            total, detail = roll_dice(hint)
            return {"expr": hint, "total": total, "detail": detail}
        except ValueError:
            pass
        if re.fullmatch(r"d(\d+)", hint):  # allow 'd100' style
            try:
                total, detail = roll_dice(hint)
                return {"expr": hint, "total": total, "detail": detail}
            except ValueError:
                pass

    # 3) contextual heuristics
    expr = _contextual_dice_expr(user_input, story_core)
    if expr:
        total, detail = roll_dice(expr)
        return {"expr": expr, "total": total, "detail": detail}

    # 4) percent target inference
    target = _extract_percent_target(user_input or "")
    if target is not None:
        roll = random.randint(1, 100)
        success = roll <= target
        detail = f"d100: {roll} vs {target} → {'성공' if success else '실패'} (차이 {abs(roll - target)})"
        return {"expr": "d100", "total": roll, "detail": detail, "target": target, "success": success}

    return None


# --- Embedding/Memory helpers ---
def embed_texts(texts: List[str]) -> List[List[float]]:
    """Return OpenAI embeddings for a list of texts."""
    try:
        res = client.embeddings.create(model=EMBED_MODEL, input=texts)
        return [d.embedding for d in res.data]
    except Exception:
        return []

def memory_upsert(session_id: str, chunks: List[str], metadicts: List[dict]) -> None:
    if not _CHROMA_AVAILABLE or not memory_collection or not chunks:
        return
    try:
        vecs = embed_texts(chunks)
        if not vecs:
            return
        ids = [f"{session_id}:{uuid.uuid4()}" for _ in chunks]
        memory_collection.upsert(
            ids=ids,
            embeddings=vecs,
            documents=chunks,
            metadatas=[{"session_id": session_id, **m} for m in metadicts],
        )
    except Exception:
        # fail silently in dev
        pass

def memory_query(session_id: str, query: str, k: int = MEMORY_TOP_K) -> List[str]:
    if not _CHROMA_AVAILABLE or not memory_collection or not query.strip():
        return []
    try:
        qvecs = embed_texts([query])
        if not qvecs:
            return []
        res = memory_collection.query(query_embeddings=qvecs, n_results=k, where={"session_id": session_id})
        docs = (res.get("documents") or [[]])[0]
        return docs
    except Exception:
        return []

def extract_core_from(history: list[str]) -> dict:
    """Summarize recent history into core facts/relationships/open_threads."""
    if not history:
        return {}
    prompt = (
        "다음 대화에서 줄거리 진행에 중요한 핵심만 JSON으로 요약해줘.\n"
        "필드: facts[], relationships[], open_threads[].\n"
        f"대화:\n{chr(10).join(history[-12:])}\n"
        "반드시 JSON만 출력."
    )
    try:
        r = chat([{"role": "user", "content": prompt}], temperature=0.2, max_tokens=250)
        content = r.choices[0].message.content or "{}"
        data = json.loads(content)
        return {
            "facts": list(data.get("facts", [])),
            "relationships": list(data.get("relationships", [])),
            "open_threads": list(data.get("open_threads", [])),
        }
    except Exception:
        return {}

def merge_core(dst: dict, src: dict) -> dict:
    def merge_list(a, b):
        a = a or []
        b = b or []
        seen = set(a)
        out = list(a)
        for x in b:
            if x not in seen:
                out.append(x)
                seen.add(x)
        return out
    dst = dst or {}
    src = src or {}
    return {
        **dst,
        "facts": merge_list(dst.get("facts"), src.get("facts")),
        "relationships": merge_list(dst.get("relationships"), src.get("relationships")),
        "open_threads": merge_list(dst.get("open_threads"), src.get("open_threads")),
    }

# ==========================
# Schemas
# ==========================
class TRPGRequest(BaseModel):
    session_id: str
    user_input: str
    role: str  # 'gm'|'keeper'|'player'|'npc'|'enemy'
    situation: str
    character: str
    persona: Optional[dict] = None  # 선택: Persona 스키마

class InitStoryRequest(BaseModel):
    core: dict  # 세계관/배경 핵심 정보

 # Helper: create session from core (used by /trpg/init and /dev/quickstart)
def _create_session_from_core(story_core: dict) -> tuple[str, list[dict]]:
    system_msg = {"role": "system", "content": json.dumps({"core": story_core}, ensure_ascii=False)}
    user_msg = {
        "role": "user",
        "content": "이야기를 5막 구조로 분할해줘. 각 막의 목표와 주요 사건을 JSON 배열로 간략히 정리해줘. 각 항목은 {\"act\": number, \"description\": string} 형태.",
    }
    try:
        response = chat([system_msg, user_msg], max_tokens=300)
        content = response.choices[0].message.content or ""
        try:
            outline = json.loads(content)
        except Exception:
            outline = [
                {"act": i + 1, "description": line}
                for i, line in enumerate([s for s in content.splitlines() if s.strip()])
            ]
    except Exception:
        # 모델 오류시 최소 안전한 기본값
        outline = [
            {"act": 1, "description": "도입"},
            {"act": 2, "description": "발전"},
            {"act": 3, "description": "위기"},
            {"act": 4, "description": "절정"},
            {"act": 5, "description": "결말"},
        ]
    session_id = str(uuid.uuid4())
    state = SessionState(
        story_core=story_core,
        plot_outline=outline,
        current_act=0,
        history=[],
        personas={},
    )
    sessions[session_id] = state
    save_session(session_id, state)
    return session_id, outline

# ==========================
# Endpoints
# ==========================
@app.post("/trpg/init")
def init_story(request: InitStoryRequest):
    """세션 생성 + 5막 아웃라인 작성 + 초기 상태 저장"""
    story_core = request.core
    session_id, outline = _create_session_from_core(story_core)
    return {"session_id": session_id, "outline": outline}

@app.post("/trpg/reply")
def trpg_reply(request: TRPGRequest):
    # 세션 로드 (디스크 → 메모리 캐시)
    state = load_session(request.session_id) or sessions.get(request.session_id)
    if not state:
        return {"error": "Invalid session_id"}

    # 메모리 검색 (retrieval)
    retrieved_notes = memory_query(request.session_id, request.user_input, MEMORY_TOP_K)

    # 주사위 롤 파싱 (인터럽트하지 않고 컨텍스트로 전달)
    roll_info = infer_roll_from_texts(request.user_input, request.character, state.story_core)
    if roll_info:
        state.history.append(f"roll: {roll_info['detail']}")

    # 역할 정규화
    role_norm = (request.role or "").strip().lower()
    if role_norm in {"gm", "keeper", "dm", "kp"}:
        role_type = "GM"
        speaker_name = "사회자"
    elif role_norm in {"enemy", "foe", "opponent"}:
        role_type = "ENEMY"
        speaker_name = request.character or "적"
    elif role_norm in {"npc"}:
        role_type = "NPC"
        speaker_name = request.character or "NPC"
    else:
        role_type = "PLAYER"
        speaker_name = request.character or "플레이어"

    # 페르소나 구성/저장
    persona: Persona
    if request.persona:
        persona = Persona(**{
            "role_type": role_type,
            "name": speaker_name,
            **request.persona,
        })
    else:
        persona = Persona(role_type=role_type, name=speaker_name)

    # 세션에 페르소나 캐시(이름 기준)
    state.personas[persona.name] = persona

    # 장면 도입 1회만 허용하기 위한 플래그와 스타일 계산
    intro_done = getattr(state, "scene_intro_done", False)
    keep_len = "3~7문장"
    if role_type == "GM" and intro_done:
        keep_len = "2~4문장"
    elif role_type in {"NPC", "ENEMY"}:
        keep_len = "1~3문장"
    narration_cap = 1 if (role_type == "GM" and intro_done) else 6
    dialogue_first = True if (role_type in {"NPC", "ENEMY"} or intro_done) else False
    no_recap = True if intro_done else False

    # 시스템 컨텍스트 구성
    act_info = next((a for a in state.plot_outline if a.get("act") == state.current_act), None)
    system_context = {
        "story_core": state.story_core,
        "current_act": state.current_act,
        "act_info": act_info,
        "persona": persona.model_dump(),
        "style": {
            "keep_length": keep_len,
            "stay_in_character": True,
            "avoid_ooc": True,
            "avoid_act_mentions": True,
            "no_explicit_act_numbers": True,
            "no_role_labels": True,
            "plain_text_only": True,
            "no_code_blocks": True,
            "sensory_detail": True,
            "offer_next_step": True,
            "no_echo_user": True,
            "consistent_tone": True,
            "narration_cap": narration_cap,
            "dialogue_first": dialogue_first,
            "no_recap": no_recap,
            "link_to_previous": True,
            "question_cap": 1,
            "avoid_exposition_reuse": True,
        },
        "retrieved_notes": retrieved_notes,
        "roll": roll_info,
    }

    user_content = (
        f"지금까지 대화:\n{chr(10).join(state.history[-20:])}\n"
        f"플레이어 입력: {request.user_input}\n"
    )
    if roll_info:
        user_content += (
            f"주사위 판정 결과: {roll_info['detail']} (총합 {roll_info['total']}). "
            "이 결과를 반영해 성공/실패의 정도를 자연스럽게 해석해줘.\n"
        )
    user_content += (
        f"위 정보를 반영하여 '{persona.name}'로서 자연스럽게 한 번만 응답해줘.\n"
    )
    # 역할별 자아 분리 규칙
    if role_type == "GM":
        user_content += (
            "너는 진행자다. 배경/상황/결과만 서술하고 특정 캐릭터의 1인칭 대사를 임의로 말하지 말라.\n"
        )
    elif role_type in {"NPC", "ENEMY"}:
        user_content += (
            f"너는 '{persona.name}'다. 이 캐릭터의 말투로만, 1인칭/대화 위주로 말하라. 장면 진행/메타 설명을 하지 말라.\n"
        )

    # GM 장면 도입 1회 제한 및 대화 위주 지침
    if role_type == "GM":
        if intro_done:
            user_content += (
                "이미 장면 소개는 완료되었다. 배경/이동/기본 설정의 재설명은 금지한다. "
                "배경/설명은 최대 1문장으로 제한하고, 플레이어 발화에 곧바로 반응하며 대화와 행동 중심으로 응답하라. "
                "질문은 최대 1개만 제시한다.\n"
            )
        else:
            user_content += (
                "이번 응답은 장면 소개를 처음이자 한 번만 제공한다. 공간·분위기·핵심 단서만 3~5문장으로 간결히 설명하고, "
                "과한 메타 설명은 하지 말라. 마지막에 플레이어가 취할 수 있는 다음 행동을 한 가지만 제시한다.\n"
            )

    user_content += (
        "형식 규칙:\n"
        "- 직전 응답이나 플레이어 입력을 그대로 반복·재진술하지 않는다. 문장 시작 패턴을 다양화한다.\n"
        "- 말투를 일관되게 유지한다(과도한 경어/반말 전환 금지).\n"
        "- 스피커 라벨(사회자:, NPC:, ENEMY:, 플레이어:)을 붙이지 않는다.\n"
        "- JSON/마크다운/코드블록/대괄호 태그를 출력하지 말고, 순수 한국어 문장만 출력한다.\n"
        "- 3~7문장으로, 감각(시각·청각·후각 등) 묘사를 최소 1회 포함한다.\n"
        "- 마지막 문장은 플레이어가 선택할 수 있는 다음 행동의 여지를 한 문장으로 제시한다.\n"
        "- 챕터/Act 번호는 언급하지 않는다."
    )
    system_msg = {"role": "system", "content": json.dumps(system_context, ensure_ascii=False)}
    user_msg = {"role": "user", "content": user_content}

    try:
        response = chat([system_msg, user_msg], temperature=0.8, max_tokens=180)
        reply = response.choices[0].message.content or ""
        reply = _normalize_reply(reply)
        # 첫 GM 응답 이후에는 도입을 반복하지 않도록 플래그 설정
        if role_type == "GM" and not getattr(state, "scene_intro_done", False):
            state.scene_intro_done = True
    except Exception as e:
        return {"error": str(e)}

    # 장기 기억 저장 (요약/검색용)
    try:
        turn_text = f"Player: {request.user_input}\n{persona.name}: {reply}"
        memory_upsert(request.session_id, [turn_text], [{"act": state.current_act, "speaker": persona.name}])
    except Exception:
        pass

    # 히스토리 기록 & 저장
    state.history.append(request.user_input)
    state.history.append(f"{persona.name}: {reply}")
    sessions[request.session_id] = state
    save_session(request.session_id, state)

    # N라인마다 핵심기억 업데이트
    if len(state.history) % MEMORY_EVERY_N == 0:
        core = extract_core_from(state.history)
        if core:
            state.story_core = merge_core(state.story_core, core)
            save_session(request.session_id, state)

    result = {
        "speaker": persona.name,
        "reply": reply,
        "emotion": "unknown",
    }
    if roll_info:
        result.update({"roll": roll_info["total"], "detail": roll_info["detail"]})
    return result

class SceneRequest(BaseModel):
    session_id: str
    act: int

@app.post("/trpg/scene")
def scene(request: SceneRequest):
    state = load_session(request.session_id) or sessions.get(request.session_id)
    if not state:
        return {"error": "Invalid session_id"}

    act_info = next((a for a in state.plot_outline if a.get("act") == request.act), None)
    if not act_info:
        return {"error": f"Act {request.act} not found in outline."}

    # 새 장면 시작 → 다음 GM 응답에서만 장면 소개 1회 허용
    state.scene_intro_done = False

    system_msg = {
        "role": "system",
        "content": json.dumps({"core": state.story_core, "act": act_info}, ensure_ascii=False),
    }
    user_msg = {
        "role": "user",
        "content": f"현재까지 대화:\n{chr(10).join(state.history[-20:])}\n이제 다음 장면을 자연스럽게 이어가줘. (챕터/Act 번호는 언급하지 말 것.)",
    }

    try:
        response = chat([system_msg, user_msg], temperature=0.8, max_tokens=320)
        reply = response.choices[0].message.content or ""
    except Exception as e:
        return {"error": str(e)}

    state.history.append(f"Act {request.act} scene: {reply}")
    state.current_act = request.act

    sessions[request.session_id] = state
    save_session(request.session_id, state)

    return {
        "act": request.act,
        "description": act_info,
        "scene": reply,
    }


# ==========================
# Session/Persona endpoints
# ==========================

@app.get("/trpg/session/{sid}")
def get_session(sid: str):
    state = load_session(sid) or sessions.get(sid)
    if not state:
        raise HTTPException(status_code=404, detail="Invalid session_id")
    return {
        "story_core": state.story_core,
        "outline": state.plot_outline,
        "current_act": state.current_act,
        "scene_intro_done": getattr(state, "scene_intro_done", False),
        "recent_history": state.history[-30:],
        "personas": {k: v.model_dump() for k, v in state.personas.items()},
    }

class PersonaSetRequest(BaseModel):
    session_id: str
    character: str
    role: Optional[str] = None
    persona: dict

@app.post("/trpg/persona")
def set_persona(req: PersonaSetRequest):
    state = load_session(req.session_id) or sessions.get(req.session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Invalid session_id")
    role_norm = (req.role or "").strip().lower()
    if role_norm in {"gm", "keeper", "dm", "kp"}:
        role_type = "GM"
    elif role_norm in {"enemy", "foe", "opponent"}:
        role_type = "ENEMY"
    elif role_norm in {"npc"}:
        role_type = "NPC"
    else:
        role_type = "PLAYER"
    p = Persona(role_type=role_type, name=req.character, **(req.persona or {}))
    state.personas[p.name] = p
    save_session(req.session_id, state)
    return {"ok": True, "persona": p.model_dump()}


# ==========================
# DEV PLAYGROUND (optional)
# ==========================
class DevInitRequest(BaseModel):
    world: Optional[str] = None
    theme: Optional[str] = None

class DevSayRequest(BaseModel):
    msg: str
    character: Optional[str] = None
    persona: Optional[dict] = None

def ensure_dev_session(world: str = "도시 미스터리", theme: str = "기이한 실종") -> str:
    global DEV_SESSION_ID
    if DEV_SESSION_ID and (load_session(DEV_SESSION_ID) or sessions.get(DEV_SESSION_ID)):
        return DEV_SESSION_ID
    sid, _ = _create_session_from_core({"world": world, "theme": theme})
    DEV_SESSION_ID = sid
    return sid

@app.post("/dev/quickstart")
def dev_quickstart(req: DevInitRequest):
    if not DEV_MODE:
        return {"error": "DEV_MODE is disabled. Set DEV_MODE=true in .env to enable."}
    sid = ensure_dev_session(req.world or "도시 미스터리", req.theme or "기이한 실종")
    state = load_session(sid) or sessions.get(sid)
    return {"session_id": sid, "outline": state.plot_outline if state else []}

@app.post("/dev/gm")
def dev_gm(req: DevSayRequest):
    if not DEV_MODE:
        return {"error": "DEV_MODE disabled"}
    sid = ensure_dev_session()
    tr = TRPGRequest(session_id=sid, user_input=req.msg, role="gm", situation="dev", character=req.character or "사회자", persona=req.persona)
    return trpg_reply(tr)

@app.post("/dev/npc")
def dev_npc(req: DevSayRequest):
    if not DEV_MODE:
        return {"error": "DEV_MODE disabled"}
    sid = ensure_dev_session()
    tr = TRPGRequest(session_id=sid, user_input=req.msg, role="npc", situation="dev", character=req.character or "NPC", persona=req.persona)
    return trpg_reply(tr)

@app.post("/dev/enemy")
def dev_enemy(req: DevSayRequest):
    if not DEV_MODE:
        return {"error": "DEV_MODE disabled"}
    sid = ensure_dev_session()
    tr = TRPGRequest(session_id=sid, user_input=req.msg, role="enemy", situation="dev", character=req.character or "적", persona=req.persona)
    return trpg_reply(tr)

@app.post("/dev/roll")
def dev_roll(req: DevSayRequest):
    if not DEV_MODE:
        return {"error": "DEV_MODE disabled"}
    sid = ensure_dev_session()
    tr = TRPGRequest(session_id=sid, user_input=req.msg, role="gm", situation="dev", character="사회자")
    return trpg_reply(tr)

@app.post("/dev/scene")
def dev_scene(act: SceneRequest):
    if not DEV_MODE:
        return {"error": "DEV_MODE disabled"}
    sid = ensure_dev_session()
    return scene(SceneRequest(session_id=sid, act=act.act))

@app.get("/dev/ui", response_class=HTMLResponse)
def dev_ui():
    if not DEV_MODE:
        return HTMLResponse("<h3>DEV_MODE=false</h3>")
    html = """
    <!doctype html>
    <meta charset=\"utf-8\" />
    <title>TRPG Dev Playground</title>
    <style>
        :root { --bg:#f7f7f9; --card:#ffffff; --ink:#111; --muted:#666; --line:#e5e7eb; }
        body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; margin: 24px; background: var(--bg); color: var(--ink); }
        h2 { margin: 0 0 12px; }
        .card { background: var(--card); border:1px solid var(--line); border-radius: 12px; padding:16px; margin-bottom:12px; }
        .row { display:flex; gap:8px; align-items:center; }
        .row > * { flex:1; }
        input, textarea, select { width:100%; padding:10px; border:1px solid var(--line); border-radius:8px; box-sizing:border-box; font-size:14px; }
        textarea { min-height: 90px; }
        button { padding:10px 14px; border:1px solid var(--line); background:#fff; border-radius:8px; cursor:pointer; }
        button.primary { background:#111; color:#fff; border-color:#111; }
        .chips { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
        .chip { padding:6px 10px; border-radius:999px; border:1px solid var(--line); background:#fff; font-size:12px; cursor:pointer; }
        .muted { color: var(--muted); font-size:12px; }
        .kv { display:flex; gap:8px; }
        .kv > div { flex:1; }
        .help { background:#fafafa; border:1px dashed var(--line); padding:10px; border-radius:8px; margin-top:8px; font-size:13px; }
        details summary { cursor:pointer; }

        /* Chat */
        .chat { background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px; height: 340px; overflow:auto; }
        .msg { display:flex; margin:10px 0; gap:8px; }
        .msg .bubble { padding:10px 12px; border-radius:12px; border:1px solid var(--line); max-width:72%; white-space:pre-wrap; }
        .msg.me { justify-content: flex-end; }
        .msg.me .bubble { background:#e7f0ff; }
        .msg.ai .bubble { background:#f1f5f9; }
        .msg .meta { font-size:12px; color:var(--muted); margin: 0 4px; }
        .right { text-align:right; }
        .toolbar { display:flex; gap:8px; align-items:center; }
        .hide { display:none; }
        pre#out { display:none; }
    </style>

    <h2>TRPG Dev Playground</h2>

    <div class=\"card\">
      <div class=\"row\">
        <input id=\"world\" placeholder=\"world (무대/배경) 예: 현대 서울의 도시 미스터리\" />
        <input id=\"theme\" placeholder=\"theme (톤/키워드) 예: 기이한 실종\" />
        <button class=\"primary\" onclick=\"quickstart()\">Quickstart</button>
        <a href=\"/docs\" target=\"_blank\">Open API Docs</a>
      </div>
      <div class=\"muted\">Session: <code id=\"sid\">(none)</code></div>
      <details style=\"margin-top:8px;\">
        <summary>world / theme란?</summary>
        <div class=\"help\">
          <b>world</b> = 이야기의 무대/배경. 예) <i>현대 서울의 도시 미스터리</i>, <i>중세 판타지 왕국</i>, <i>스팀펑크 항구도시</i>, <i>SF 우주 식민지</i><br/>
          <b>theme</b> = 이야기의 톤/문제/장르 키워드. 예) <i>기이한 실종</i>, <i>정치 음모</i>, <i>생존 호러</i>, <i>코지 미스터리</i>.
          <div class=\"chips\">
            <button class=\"chip\" data-world=\"도시 미스터리\" data-theme=\"기이한 실종\">도시 미스터리 / 실종</button>
            <button class=\"chip\" data-world=\"중세 판타지 왕국\" data-theme=\"용의 음모\">중세 판타지 / 용의 음모</button>
            <button class=\"chip\" data-world=\"SF 우주 식민지\" data-theme=\"생존 호러\">SF 식민지 / 생존 호러</button>
          </div>
        </div>
      </details>
    </div>

    <div class=\"card\">
      <div class=\"toolbar\">
        <select id=\"responder\" style=\"max-width:240px;\">
          <option value=\"gm\">AI: 진행자</option>
          <option value=\"npc\">AI: NPC</option>
          <option value=\"enemy\">AI: ENEMY</option>
          <option value=\"roll\">주사위 굴림</option>
        </select>
        <input id=\"who\" placeholder=\"캐릭터 이름 (선택) — ROLL일 때: 'd100' 또는 '2d6+1'으로 주사위 지정 가능\" />
      </div>
      <textarea id=\"msg\" placeholder=\"메시지 또는 주사위: 예) 골목을 살핀다 / 2d6+1\"></textarea>
      <div class=\"row\">
        <button class=\"primary\" onclick=\"send()\">Send</button>
        <span class=\"muted\">규칙: 액트/장 번호(Act 1~5 등)는 말하지 않습니다.</span>
      </div>
    </div>

    <div class=\"card\">
      <h3 style=\"margin:0 0 8px;\">Output</h3>
      <div id=\"chat\" class=\"chat\"></div>
      <pre id=\"out\"></pre>
    </div>

    <script>
      // Helper: add preset chips behavior
      document.addEventListener('click', (e)=>{
        if(e.target.classList.contains('chip')){
          document.getElementById('world').value = e.target.getAttribute('data-world') || '';
          document.getElementById('theme').value = e.target.getAttribute('data-theme') || '';
        }
      });

      function pushMsg(side, meta, text){
        const chat = document.getElementById('chat');
        const wrap = document.createElement('div');
        wrap.className = 'msg ' + (side==='me' ? 'me' : side==='ai' ? 'ai' : '');
        const b = document.createElement('div');
        b.className = 'bubble';
        b.textContent = text;
        const m = document.createElement('div');
        m.className = 'meta';
        m.textContent = meta;
        if(side==='me'){
          wrap.appendChild(m);
          wrap.appendChild(b);
        } else {
          wrap.appendChild(b);
          wrap.appendChild(m);
        }
        chat.appendChild(wrap);
        chat.scrollTop = chat.scrollHeight;
      }

      async function quickstart(){
        const world = document.getElementById('world').value;
        const theme = document.getElementById('theme').value;
        const res = await fetch('/dev/quickstart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world,theme})});
        const j = await res.json();
        document.getElementById('sid').textContent = j.session_id || '(error)';
        pushMsg('ai','시스템','세션이 준비되었습니다. 원하는 역할을 선택하고 메시지를 입력하세요.');
        dump(j);
      }

      function endpointFor(kind){
        if(kind==='gm') return '/dev/gm';
        if(kind==='npc') return '/dev/npc';
        if(kind==='enemy') return '/dev/enemy';
        return '/dev/roll';
      }

      async function send(){
        const kind = document.getElementById('responder').value;
        const msg = document.getElementById('msg').value.trim();
        const character = document.getElementById('who').value.trim();
        if(!msg) return;

        if(kind==='roll'){
          pushMsg('me','나 · 주사위', msg);
          const res = await fetch('/dev/roll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({msg,character})});
          const j = await res.json();
          dump(j);
          if(j.detail){
            pushMsg('ai','시스템 · ROLL', `${j.detail} → ${j.roll}`);
          } else {
            pushMsg('ai','시스템', JSON.stringify(j));
          }
          if(j.reply){
            const sp = j.speaker || '진행자';
            pushMsg('ai', `AI(${sp})`, j.reply);
          }
          return;
        }

        const label = kind==='gm' ? '진행자' : (kind==='npc' ? 'NPC' : 'ENEMY');
        pushMsg('me', `나 → AI(${label})`, msg);
        const res = await fetch(endpointFor(kind), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({msg,character})});
        const j = await res.json();
        dump(j);
        const speaker = j.speaker || label;
        const text = j.reply || JSON.stringify(j);
        pushMsg('ai', `AI(${speaker})`, text);
        document.getElementById('msg').value='';
      }

      function dump(j){
        const pre = document.getElementById('out');
        pre.textContent = JSON.stringify(j,null,2) + '\\n\\n' + pre.textContent;
      }
    </script>
    """
    return HTMLResponse(html)