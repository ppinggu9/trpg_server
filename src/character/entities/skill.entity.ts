import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Character } from './character.entity';

export enum SkillCategory {
    Combat = 'Combat',
    Knowledge = 'Knowledge',
    // ...기타 카테고리
}

@Entity()
export class Skill {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 }) // 스킬 이름 (예: "의학 지식")
    name: string;

    @Column({ default: 0 }) // 스킬 수치 (0~100)
    value: number;
    
    @Column({ type: 'enum', enum: SkillCategory, default: SkillCategory.Combat })
    category: SkillCategory;

    // N:1 관계 - Character
    @ManyToOne(() => Character, (character) => character.skills)
    character: Character;
}