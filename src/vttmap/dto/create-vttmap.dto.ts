import { GridType } from '@/common/enums/grid-type.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { VTTMAP_ERRORS } from '../constants/vttmap.constants';
import { Transform } from 'class-transformer';

export class CreateVttMapDto {
  @ApiProperty({
    example: '던전 입구',
    description: '맵의 이름',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  name?: string;

  @ApiProperty({
    example: 'https://example.com/map.jpg',
    description: '배경 이미지의 공개 URL',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  imageUrl?: string;

  @ApiProperty({
    enum: GridType,
    enumName: 'GridType',
    default: GridType.SQUARE,
    description: '그리드 유형 (square: 사각형, none: 없음)',
  })
  @IsEnum(GridType)
  @IsOptional()
  gridType?: GridType = GridType.SQUARE;

  @ApiProperty({
    minimum: 10,
    maximum: 200,
    default: 50,
    description: '그리드 한 변의 크기 (픽셀 단위)',
  })
  @IsInt()
  @Min(10, { message: VTTMAP_ERRORS.INVALID_GRID_SIZE })
  @Max(200, { message: VTTMAP_ERRORS.INVALID_GRID_SIZE })
  @IsOptional()
  gridSize?: number = 50;

  @ApiProperty({
    default: true,
    description: '그리드 표시 여부',
  })
  @IsOptional()
  showGrid?: boolean = true;
}
