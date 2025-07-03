import { Expose } from 'class-transformer';

export class SanLossResponseDto {
  @Expose()
  amount: number;

  @Expose()
  reason: string;

  @Expose()
  createdAt: Date;
}