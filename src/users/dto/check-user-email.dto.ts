import { PartialType, PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class CheckEmailRequest extends PickType(CreateUserDto, ['email'] as const) {}