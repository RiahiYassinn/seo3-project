// apps/api-gateway/src/auth/dto/auth.dto.ts
import { 
  IsEmail, 
  IsString, 
  MinLength, 
  MaxLength, 
  Matches,
  IsOptional,
  IsBoolean,
  IsNotEmpty
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @IsNotEmpty()
  refresh_token: string;
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