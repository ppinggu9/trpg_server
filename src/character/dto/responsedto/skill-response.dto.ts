import { Expose } from 'class-transformer';

export class SkillResponseDto {
  @Expose()
  name: string;

  @Expose()
  value: number;

  @Expose()
  isHard: boolean;

  @Expose()
  isExtreme: boolean;
}