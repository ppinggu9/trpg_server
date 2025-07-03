import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Character } from "./character.entity";

@Entity()
export class SanLoss {
  @PrimaryGeneratedColumn()
  id: number;

  @Column() 
  amount: number; // 손실량 (예: 1d10)

  @Column({ type: 'text', nullable: true }) 
  reason: string; // 사유

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  // N : 1 관계 character
  @ManyToOne(() => Character, (character) => character.sanLosses)
  character: Character;
}