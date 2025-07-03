import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Character } from './character.entity';

@Entity()
export class Stats {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 50 }) // STR (근력)
  str: number;

  @Column({ default: 50 }) // CON (건강)
  con: number;

  @Column({ default: 50 }) // SIZ (체격)
  siz: number;

  @Column({ default: 50 }) // DEX (민첩)
  dex: number;

  @Column({ default: 50 }) // APP (매력)
  app: number;

  @Column({ default: 50 }) // INT (지능)
  int: number;

  @Column({ default: 50 }) // POW (의지)
  pow: number;

  @Column({ default: 50 }) // EDU (교육)
  edu: number;

  @Column({ default: 50 }) // LUCK (행운)
  luck: number;

  // 1:1 관계 - Character
  @OneToOne(() => Character, (character) => character.stats)
  @JoinColumn()
  character: Character;
}