import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dtos/create-user.dto';
import { classToPlain } from 'class-transformer';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const user = this.usersRepository.create(createUserDto);
      return await this.usersRepository.save(user);
    } catch (error) {
      // Handle duplicate email error
      if (error instanceof QueryFailedError && error.driverError.code === '23505') {
        throw new Error('A user with this email already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    return await this.usersRepository.find();
  }

  async findOneById(id: string): Promise<User | null> {
    return await this.usersRepository.findOneBy({ id });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOneBy({ email });
  }

  async update(id: string, updateUserDto: Partial<User>): Promise<User | null> {
    try {
      await this.usersRepository.update(id, updateUserDto);
      return await this.usersRepository.findOneBy({ id });
    } catch (error) {
      // Handle duplicate email error for updates
      if (error instanceof QueryFailedError && error.driverError.code === '23505') {
        throw new Error('A user with this email already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }
}