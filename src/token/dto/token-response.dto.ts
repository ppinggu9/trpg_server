export class TokenResponseDto {
  id: string;
  mapId: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  imageUrl?: string;
  characterSheetId: number | null;
  npcId: number | null;
}
