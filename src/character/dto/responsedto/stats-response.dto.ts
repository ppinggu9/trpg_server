import { Expose } from 'class-transformer';

export class StatsResponseDto {
  @Expose()
  str: number;

  @Expose()
  con: number;

  @Expose()
  siz: number;

  @Expose()
  dex: number;

  @Expose()
  app: number;

  @Expose()
  int: number;

  @Expose()
  pow: number;

  @Expose()
  edu: number;

  @Expose()
  luck: number;
}