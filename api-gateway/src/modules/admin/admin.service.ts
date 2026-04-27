import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { UpdateUserDto, CreateUserDto } from './dto/user.dto';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

type UploadedAvatarFile = {
  mimetype: string;
  size: number;
  originalname: string;
  buffer: Buffer;
};

@Injectable()
export class AdminService {
  constructor(
    @Inject('DEVELOPER_SERVICE') private developerService: ClientProxy,
    private readonly configService: ConfigService,
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
      const existingUser = await firstValueFrom(
        this.developerService.send('check_user_exists', {
          email: createUserDto.email,
          username: createUserDto.username,
        })
      );

      if (existingUser.exists) {
        throw new ConflictException('Email or username already exists');
      }

      const plainPassword = createUserDto.password;
      const hashedPassword = await bcrypt.hash(
        createUserDto.password,
        parseInt(this.configService.get('BCRYPT_ROUNDS', '10'))
      );

      const newUser = await firstValueFrom(
        this.developerService.send('create_user', {
          email: createUserDto.email,
          username: createUserDto.username,
          firstName: createUserDto.first_name,
          lastName: createUserDto.last_name,
          password: hashedPassword,
          role: createUserDto.role,
        })
      );

      const verificationToken = uuidv4();

      await firstValueFrom(
        this.developerService.send('create_verification_token', {
          userId: newUser.id,
          token: verificationToken,
        })
      );

      await firstValueFrom(
        this.developerService.send('send_verification_email', {
          email: newUser.email,
          name: `${newUser.first_name} ${newUser.last_name}`,
          token: verificationToken,
        })
      );

      await firstValueFrom(
        this.developerService.send('send_credentials_email', {
          email: newUser.email,
          name: `${newUser.first_name} ${newUser.last_name}`,
          username: newUser.username,
          password: plainPassword,
        })
      );

      return newUser;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException((error as any)?.message || 'Failed to create user');
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
      throw new BadRequestException((error as any)?.message || 'Failed to update user');
    }
  }

  async uploadUserAvatar(userId: string, file: UploadedAvatarFile) {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    const maxFileSize = 5 * 1024 * 1024;
    if (file.size > maxFileSize) {
      throw new BadRequestException('Avatar size must be less than 5MB');
    }

    const uploadDir = join(process.cwd(), 'uploads', 'avatars');
    await mkdir(uploadDir, { recursive: true });

    const extensionFromName = file.originalname?.includes('.')
      ? file.originalname.split('.').pop()?.toLowerCase()
      : null;
    const extension = extensionFromName || file.mimetype.split('/').pop() || 'png';
    const fileName = `${randomUUID()}.${extension}`;
    const filePath = join(uploadDir, fileName);

    await writeFile(filePath, file.buffer);

    const avatarPath = `/uploads/avatars/${fileName}`;

    const existingUser = await this.getUserById(userId);
    const previousAvatar = existingUser?.avatar;

    const updatedUser = await firstValueFrom(
      this.developerService.send('admin_update_user', {
        userId,
        avatar: avatarPath,
      })
    );

    if (
      typeof previousAvatar === 'string' &&
      previousAvatar.startsWith('/uploads/avatars/') &&
      previousAvatar !== avatarPath
    ) {
      const previousFileName = previousAvatar.split('/').pop();
      if (previousFileName) {
        const previousPath = join(uploadDir, previousFileName);
        try {
          await unlink(previousPath);
        } catch {
          // Ignore cleanup failures for old files.
        }
      }
    }

    return {
      ...updatedUser,
      avatar_url: avatarPath,
    };
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
      throw new BadRequestException((error as any)?.message || 'Failed to delete user');
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
