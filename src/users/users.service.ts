import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    const { name, nickname, email, password } = createUserDto;
    const checkExist = await this.isUserExists(email);
    if (checkExist) {
      throw new ConflictException(`This email ${email} is already existed!`);
    }
    const nicknameExist = await this.isNicknameAvailable(nickname);
    if (nicknameExist) {
      throw new ConflictException(
        `This nickname ${nickname} is already existed!`,
      );
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      name: name,
      nickname: nickname,
      email: email,
      passwordHash: hashedPassword,
    });
    return this.usersRepository.save(user);
  }

  async getUserById(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: {
        id: id,
      },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException('Cannot find User');
    }
    return user;
  }

  async isUserExists(email: string): Promise<boolean> {
    return this.usersRepository
      .findOne({
        where: { email: email },
        withDeleted: true,
      })
      .then((user) => {
        if (user) {
          return true;
        } else {
          return false;
        }
      });
  }

  async isNicknameAvailable(nickname: string): Promise<boolean> {
    return this.usersRepository
      .findOne({
        where: { nickname: nickname },
        withDeleted: true,
      })
      .then((user) => {
        if (user) {
          return true;
        } else {
          return false;
        }
      });
  }

  // only for authenticating
  async getUserByEmail(email: string): Promise<User> {
    return this.usersRepository
      .findOne({
        where: { email: email },
      })
      .then((user) => {
        if (user) {
          return user;
        } else {
          throw new NotFoundException(
            `This email ${email} user could not be found`,
          );
        }
      });
  }
}
