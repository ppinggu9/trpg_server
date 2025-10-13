import { PartialType } from '@nestjs/swagger';
import { CreateVttMapDto } from './create-vttmap.dto';

export class UpdateVttMapDto extends PartialType(CreateVttMapDto) {}
