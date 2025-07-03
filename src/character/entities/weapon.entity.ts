import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Character } from './character.entity';

export enum ValidStats {
    STR = 'STR',
    CON = 'CON',
    SIZ = 'SIZ',
    DEX = 'DEX',
    APP = 'APP',
    INT = 'INT',
    POW = 'POW',
    EDU = 'EDU'
}

@Entity()
export class Weapon {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 }) // 무기 이름 (예: "권총")
    name: string;

    @Column({ type: 'enum', enum: ValidStats, default: ValidStats.DEX }) //  공격 스탯
    attackStat: ValidStats;

    @Column({ length: 20 }) // 피해 Dice (예: "1d10")
    damageDice: string;

    @Column({ default: 0 }) // 추가 피해 보너스 (DB)
    damageBonus: number;

    @Column({ default: 0 }) // 공격 성공 시도 비율 (%)
    successRate: number;
    
    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    // N:1 관계 - Character
    @ManyToOne(() => Character, (character) => character.weapons)
    character: Character;
}