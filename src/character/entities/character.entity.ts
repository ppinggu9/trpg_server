// src/character/entities/character.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, JoinColumn, DeleteDateColumn } from 'typeorm';
import { Stats } from './stats.entity';
import { SanLoss } from './san-loss.entity';
import { Skill } from './skill.entity';
import { Weapon } from './weapon.entity';

@Entity()
export class Character {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 }) // 캐릭터 이름
    name: string;

    @Column({ nullable: true }) // 프로필 이미지 URL
    imageUrl: string;

    @Column({ default: 'None' }) // 직업
    occupation: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) // 생성일
    createdAt: Date;

    // 1:1 관계 - Stats
    @OneToOne(() => Stats, { eager: true })
    @JoinColumn()
    stats: Stats;

    // 1:N 관계 - Skills
    @OneToMany(() => Skill, (skill) => skill.character, { eager: false })
    skills: Skill[];

    // 1:N 관계 - Weapons
    @OneToMany(() => Weapon, (weapon) => weapon.character)
    weapons: Weapon[];

    // 1:N 관계 - SanLoss
    @OneToMany(() => SanLoss, (sanLoss) => sanLoss.character)
    sanLosses: SanLoss[];

    @DeleteDateColumn()
    deletedAt: Date;

}