import { PartialType } from '@nestjs/mapped-types';
import { CreateSkillDto } from './createdto/create-skill.dto';

export class UpdateSkillDto extends PartialType(CreateSkillDto) {}