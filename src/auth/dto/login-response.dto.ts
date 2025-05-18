// auth/dto/login-response.dto.ts
import { UserRole } from "src/users/entities/user-role.enum";

class UserResponse {
  name: string;
  nickname: string;
  email: string;
  role: UserRole;
}

export class LoginResponseDto {
  access_token: string;
  refresh_token: string;
  user: UserResponse;
}