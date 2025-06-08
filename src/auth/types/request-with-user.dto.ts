import { Request } from 'express';
import { User } from 'src/users/entities/user.entity';

export class RequestWithUser extends Request {
  user: User;
}
