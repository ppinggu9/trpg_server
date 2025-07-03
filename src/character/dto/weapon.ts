import { Min, Max, IsString, IsOptional } from 'class-validator';

export class WeaponDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @Min(1)
    @Max(100)
    damage: number;
}