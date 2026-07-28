// apps/api-gateway/src/auth/dto/auth.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsIn
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'john_doe' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores'
  })
  username: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  last_name: string;

  @ApiProperty({ example: 'StrongP@ssw0rd123' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
  password: string;

  @ApiPropertyOptional({
    example: 'developer',
    description: 'User role (defaults to "developer" if not provided)',
    enum: ['developer', 'tech_lead', 'admin']
  })
  @IsOptional()
  @IsString()
  @IsIn(['developer', 'tech_lead', 'admin'], {
    message: 'Role must be one of: developer, tech_lead, admin'
  })
  role?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com or john_doe' })
  @IsString()
  @IsNotEmpty()
  username_or_email: string;

  @ApiProperty({ example: 'StrongP@ssw0rd123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  refresh_token?: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  refresh_token?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  @IsOptional()
  logout_all_devices?: boolean;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ResendVerificationDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  new_password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  new_password: string;
}

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ description: 'Public username', example: 'maya-dev' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username?: string;

  @ApiPropertyOptional({ description: 'First name', example: 'Maya' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  first_name?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Ben Ali' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  last_name?: string;

  @ApiPropertyOptional({ description: 'Short bio shown on the profile' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ description: 'Where the user is based', example: 'Tunis, TN' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ description: 'Personal or company website' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class UpdateMentorAvailabilityDto {
  @ApiProperty({
    description: 'Whether the current tech lead is available for new mentorship assignments',
    example: true,
  })
  @IsBoolean()
  is_mentor: boolean;
}

// Optional: Add a DTO for updating user role (for admin use)
export class UpdateUserRoleDto {
  @ApiProperty({
    enum: ['developer', 'tech_lead', 'admin'],
    description: 'New role for the user'
  })
  @IsString()
  @IsIn(['developer', 'tech_lead', 'admin'], {
    message: 'Role must be one of: developer, tech_lead, admin'
  })
  role: string;
}
