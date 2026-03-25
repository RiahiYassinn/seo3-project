import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { UpdateUserDto, CreateUserDto } from './dto/user.dto';

@Injectable()
export class AdminService {
  constructor(
    @Inject('DEVELOPER_SERVICE') private developerService: ClientProxy,
  ) {}

  async getAllUsers() {
    try {
      const response = await firstValueFrom(
        this.developerService.send('get_all_users', {})
      );
      return {
        users: response.users || [],
        active_today: response.active_today || 0,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch users');
    }
  }

  async getUserById(userId: string) {
    try {
      const user = await firstValueFrom(
        this.developerService.send('get_user_by_id', { userId })
      );
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch user');
    }
  }

  async createUser(createUserDto: CreateUserDto) {
    try {
      const newUser = await firstValueFrom(
        this.developerService.send('admin_create_user', createUserDto)
      );
      return newUser;
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to create user');
    }
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    try {
      const updatedUser = await firstValueFrom(
        this.developerService.send('admin_update_user', {
          userId,
          ...updateUserDto,
        })
      );
      if (!updatedUser) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      return updatedUser;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update user');
    }
  }

  async deleteUser(userId: string) {
    try {
      const result = await firstValueFrom(
        this.developerService.send('admin_delete_user', { userId })
      );
      if (!result.success) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      return { message: 'User deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to delete user');
    }
  }

  async getUserStats() {
    try {
      const stats = await firstValueFrom(
        this.developerService.send('get_user_stats', {})
      );
      return stats;
    } catch (error) {
      throw new BadRequestException('Failed to fetch user statistics');
    }
  }
}
