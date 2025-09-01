import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordRequest } from './dto/update-user-password.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { UpdateUserNicknameRequest } from './dto/update-user-nickname.dto';
import { Transactional } from 'typeorm-transactional';
import { RoomParticipantService } from '@/room/room-participant.service';
import { UserDeleteResponseDto } from './dto/user-delete-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => RoomParticipantService))
    private roomParticipantService: RoomParticipantService,
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
    await this.usersRepository.save(user);
    return {
      userId: user.id,
      email: user.email,
      message: 'Successfully created account',
    };
  }

  async getUserById(id: number): Promise<User> {
    return this.usersRepository.findOne({
      where: {
        id: id,
      },
      withDeleted: true,
    });
  }

  async getActiveUserById(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
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

  async updateUserNickname(
    userId: number,
    updateDto: UpdateUserNicknameRequest,
  ): Promise<{ message: string }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('This user could not be found.');
    }

    const nicknameExist = await this.isNicknameAvailable(updateDto.nickname);

    if (nicknameExist) {
      throw new ConflictException(
        `This nickname ${updateDto.nickname} is already existed!`,
      );
    }

    user.nickname = updateDto.nickname;
    await this.usersRepository.save(user);
    return { message: 'Nickname change successful.' };
  }

  async updateUserPassword(
    userId: number,
    updateDto: UpdateUserPasswordRequest,
  ): Promise<{ message: string }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('This user could not be found.');
    }
    const hashedPassword = await bcrypt.hash(updateDto.password, 10);
    user.passwordHash = hashedPassword;
    await this.usersRepository.save(user);
    return {
      message: 'Passcode change successful.',
    };
  }

  @Transactional()
  async softDeleteUser(userId: number): Promise<UserDeleteResponseDto> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('This user could not be found.');
    }
    await this.roomParticipantService.leaveAllRoomsByUserId(user.id);
    const result = await this.usersRepository.softDelete(userId);
    if (result.affected !== 1) {
      throw new InternalServerErrorException('User deletion failed');
    }
    return {
      message: 'Successfully deleted account',
      success: true,
    };
  }

  // room에서 사용
  async updateUser(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }
}
