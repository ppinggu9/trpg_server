import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class AuthService {
    constructor(private readonly usersService: UsersService){}

    async validateUser(email:string, password: string): Promise<User>{
        const user = await this.usersService.getUserByEmail(email).catch(() => {
            throw new UnauthorizedException('Invalid credentials');
        });
        if(user && (await bcrypt.compare(password, user.passwordHash))){
            return user;
        } else {
            throw new UnauthorizedException('Invalid credentials');
        }
    }


}
