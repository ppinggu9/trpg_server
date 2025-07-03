import { Expose } from 'class-transformer';

export class WeaponResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  damage: number;

  @Expose()
  createdAt: Date;
}