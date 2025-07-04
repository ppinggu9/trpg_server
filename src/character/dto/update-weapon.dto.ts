import { PartialType } from '@nestjs/mapped-types';
import { CreateWeaponDto } from './createdto/create-weapon.dto';

export class UpdateWeaponDto extends PartialType(CreateWeaponDto) {}