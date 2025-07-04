import { Expose } from 'class-transformer';

export class SanLossResponseDto {
  @Expose()
  id: number;

  @Expose()
  amount: number;

  @Expose()
  reason: string;

  @Expose()
  createdAt: Date;
}