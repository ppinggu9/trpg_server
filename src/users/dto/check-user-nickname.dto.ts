import { PartialType, PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class CheckNicknameRequest extends PickType(CreateUserDto, ['nickname'] as const) {}