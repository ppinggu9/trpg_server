import { UserRole } from 'src/users/entities/user-role.enum';

export class jwtPayloadDto {
  id: number;
  email: string;
  role: UserRole;
}

export class jwtValidatedOutputDto {
  id: number;
  email: string;
  role: UserRole;
}
