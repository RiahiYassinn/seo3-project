import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/** Deterministic SHA-256 hash for storing/looking up opaque tokens in the DB. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject('DEVELOPER_SERVICE') private developerService: ClientProxy
  ) { }

  async register(registerDto: any, metadata: any) {
    try {
      // Validate if user exists
      const existingUser = await firstValueFrom(
        this.developerService.send('check_user_exists', {
          email: registerDto.email,
          username: registerDto.username
        })
      );

      if (existingUser.exists) {
        throw new ConflictException('Email or username already exists');
      }

      // Validate role (optional: add role validation)
      const validRoles = ['developer', 'tech_lead', 'admin'];
      const userRole = registerDto.role && validRoles.includes(registerDto.role)
        ? registerDto.role
        : 'developer';

      const plainPassword = registerDto.password;
      // Hash password
      const hashedPassword = await bcrypt.hash(
        registerDto.password,
        parseInt(this.configService.get('BCRYPT_ROUNDS', '10'))
      );

      // Create user in developer service with role
      const user = await firstValueFrom(
        this.developerService.send('create_user', {
          email: registerDto.email,
          username: registerDto.username,
          firstName: registerDto.first_name,
          lastName: registerDto.last_name,
          password: hashedPassword,
          role: userRole, // Add role here
        })
      );

      // Generate email verification token
      const verificationToken = uuidv4();
      await firstValueFrom(
        this.developerService.send('create_verification_token', {
          userId: user.id,
          token: verificationToken
        })
      );

      // Send verification email via notification service
      await firstValueFrom(
        this.developerService.send('send_verification_email', {
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          token: verificationToken
        })
      );

      await firstValueFrom(
        this.developerService.send('send_credentials_email', {
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          username: user.username,
          password: plainPassword,  // plain text, captured before hashing
        })
      );
      // Log registration
      await this.logActivity(user.id, 'registration', metadata);

      return {
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          avatar: user.avatar ?? null,
          is_mentor: !!user.is_mentor,
        }
      };
    } catch (error) {
      this.logger.error(`Registration failed: ${error.message}`);
      throw error;
    }
  }

  async validateUser(usernameOrEmail: string, password: string) {
    try {
      const user = await firstValueFrom(
        this.developerService.send('find_user_by_login', {
          usernameOrEmail
        })
      );

      if (!user) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        return null;
      }

      if (!user.is_email_verified) {
        throw new UnauthorizedException('Please verify your email before logging in');
      }

      if (!user.is_active) {
        throw new UnauthorizedException('Account is deactivated');
      }

      return user;
    } catch (error) {
      this.logger.error(`User validation failed: ${error.message}`);
      throw error;
    }
  }

  async login(user: any, metadata: any) {
    try {
      const isFirstLogin = !!user.is_first_login;
      const payload = {
        sub: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      };

      const [accessToken, refreshToken] = await Promise.all([
        this.generateAccessToken(payload),
        this.generateRefreshToken()
      ]);

      // Store refresh token
      const hashedRefreshToken = hashToken(refreshToken);
      await firstValueFrom(
        this.developerService.send('store_refresh_token', {
          userId: user.id,
          tokenHash: hashedRefreshToken,
          deviceInfo: metadata.deviceInfo,
          ipAddress: metadata.ip,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        })
      );

      // Log successful login
      await this.logActivity(user.id, 'login', metadata);

      // Update last login
      await firstValueFrom(
        this.developerService.send('update_last_login', {
          userId: user.id
        })
      );

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 900, // 15 minutes in seconds
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          avatar: user.avatar ?? null,
          is_first_login: isFirstLogin,
          is_mentor: !!user.is_mentor,
        }
      };
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`);
      throw error;
    }
  }

  async refreshTokens(user: any, metadata: any) {
    try {
      const currentUser = await this.getCurrentUser(user.id);

      // Validate refresh token
      const storedToken = await firstValueFrom(
        this.developerService.send('find_refresh_token', {
          userId: currentUser.id,
          tokenHash: hashToken(metadata.refreshToken)
        })
      );

      if (!storedToken || storedToken.is_revoked || storedToken.expires_at < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const payload = {
        sub: currentUser.id,
        email: currentUser.email,
        username: currentUser.username,
        role: currentUser.role
      };

      const [newAccessToken, newRefreshToken] = await Promise.all([
        this.generateAccessToken(payload),
        this.generateRefreshToken()
      ]);

      // Revoke old refresh token and store new one
      await firstValueFrom(
        this.developerService.send('rotate_refresh_token', {
          oldTokenId: storedToken.id,
          newTokenHash: hashToken(newRefreshToken),
          userId: currentUser.id,
          deviceInfo: metadata.deviceInfo,
          ipAddress: metadata.ip
        })
      );

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
        expires_in: 900,
        user: currentUser
      };
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`);
      throw error;
    }
  }

  async getCurrentUser(userId: string) {
    try {
      const user = await firstValueFrom(
        this.developerService.send('find_user_by_id', { id: userId })
      );

      if (!user || !user.is_active) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        avatar: user.avatar ?? null,
        is_first_login: !!user.is_first_login,
        is_mentor: !!user.is_mentor,
      };
    } catch (error) {
      this.logger.error(`Get current user failed: ${error.message}`);
      throw error;
    }
  }

  async updateMentorAvailability(userId: string, isMentor: boolean) {
    try {
      const currentUser = await this.getCurrentUser(userId);

      if (currentUser.role !== 'tech_lead') {
        throw new ForbiddenException('Only tech leads can update mentor availability');
      }

      const updatedUser = await firstValueFrom(
        this.developerService.send('update_my_mentor_availability', {
          userId,
          is_mentor: isMentor,
        })
      );

      return {
        message: isMentor
          ? 'You are now available for new mentorship assignments.'
          : 'You will not receive new mentorship assignments until re-enabled.',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          role: updatedUser.role,
          avatar: updatedUser.avatar ?? null,
          is_first_login: !!updatedUser.is_first_login,
          is_mentor: !!updatedUser.is_mentor,
        },
      };
    } catch (error) {
      this.logger.error(`Update mentor availability failed: ${error.message}`);
      throw error;
    }
  }

  async logout(userId: string, refreshToken?: string, logoutAllDevices: boolean = false) {
    try {
      if (logoutAllDevices) {
        // Revoke all refresh tokens for user
        await firstValueFrom(
          this.developerService.send('revoke_all_user_tokens', { userId })
        );
      } else if (refreshToken) {
        // Revoke specific refresh token
        await firstValueFrom(
          this.developerService.send('revoke_refresh_token', {
            tokenHash: hashToken(refreshToken)
          })
        );
      }

      await this.logActivity(userId, 'logout', {});

      return { message: 'Logout successful' };
    } catch (error) {
      this.logger.error(`Logout failed: ${error.message}`);
      throw error;
    }
  }

  async verifyEmail(token: string) {
    try {
      const result = await firstValueFrom(
        this.developerService.send('verify_email', { token })
      );

      if (!result) {
        throw new BadRequestException('Invalid or expired verification token');
      }

      return { message: 'Email verified successfully' };
    } catch (error) {
      this.logger.error(`Email verification failed: ${error.message}`);
      throw error;
    }
  }

  async resendVerification(email: string) {
    try {
      const user = await firstValueFrom(
        this.developerService.send('find_user_by_email', { email })
      );

      if (!user) {
        // Don't reveal if user exists
        return { message: 'If the email exists, a verification link will be sent' };
      }

      if (user.is_email_verified) {
        return { message: 'Email is already verified' };
      }

      const verificationToken = uuidv4();
      await firstValueFrom(
        this.developerService.send('create_verification_token', {
          userId: user.id,
          token: verificationToken
        })
      );

      await firstValueFrom(
        this.developerService.send('send_verification_email', {
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          token: verificationToken
        })
      );

      return { message: 'Verification email sent' };
    } catch (error) {
      this.logger.error(`Resend verification failed: ${error.message}`);
      throw error;
    }
  }

  async forgotPassword(email: string) {
    try {
      const user = await firstValueFrom(
        this.developerService.send('find_user_by_email', { email })
      );

      if (!user) {
        // Don't reveal if user exists
        return { message: 'If the email exists, a password reset link will be sent' };
      }

      const resetToken = uuidv4();
      await firstValueFrom(
        this.developerService.send('create_password_reset_token', {
          userId: user.id,
          token: resetToken,
          expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hour
        })
      );

      await firstValueFrom(
        this.developerService.send('send_password_reset_email', {
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          token: resetToken
        })
      );

      return { message: 'Password reset email sent' };
    } catch (error) {
      this.logger.error(`Forgot password failed: ${error.message}`);
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const resetRequest = await firstValueFrom(
        this.developerService.send('validate_password_reset_token', { token })
      );

      if (!resetRequest || resetRequest.is_used || resetRequest.expires_at < new Date()) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      const hashedPassword = await bcrypt.hash(
        newPassword,
        parseInt(this.configService.get('BCRYPT_ROUNDS', '10'))
      );

      await firstValueFrom(
        this.developerService.send('update_user_password', {
          userId: resetRequest.user_id,
          passwordHash: hashedPassword
        })
      );

      // Mark token as used
      await firstValueFrom(
        this.developerService.send('mark_password_reset_token_used', { token })
      );

      // Revoke all refresh tokens for security
      await firstValueFrom(
        this.developerService.send('revoke_all_user_tokens', {
          userId: resetRequest.user_id
        })
      );

      return { message: 'Password reset successful' };
    } catch (error) {
      this.logger.error(`Password reset failed: ${error.message}`);
      throw error;
    }
  }

  async changePassword(userId: string, newPassword: string) {
    try {
      const hashedPassword = await bcrypt.hash(
        newPassword,
        parseInt(this.configService.get('BCRYPT_ROUNDS', '10'))
      );

      await firstValueFrom(
        this.developerService.send('update_user_password', {
          userId,
          passwordHash: hashedPassword
        })
      );

      await firstValueFrom(
        this.developerService.send('revoke_all_user_tokens', {
          userId
        })
      );

      return { message: 'Password changed successfully' };
    } catch (error) {
      this.logger.error(`Change password failed: ${error.message}`);
      throw error;
    }
  }

  async googleLogin(googleUser: any) {
    try {
      // Try to find existing user by email
      let user = await firstValueFrom(
        this.developerService.send('find_user_by_email', { email: googleUser.email })
      ).catch(() => null);

      if (!user) {
        // Auto-register via Google
        const username = googleUser.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
        user = await firstValueFrom(
          this.developerService.send('create_google_user', {
            email: googleUser.email,
            first_name: googleUser.first_name,
            last_name: googleUser.last_name,
            google_id: googleUser.google_id,
            username,
            is_email_verified: true,
          })
        );
      } else if (!user.google_id) {
        // Link Google to existing account
        await firstValueFrom(
          this.developerService.send('link_google_account', {
            userId: user.id,
            google_id: googleUser.google_id,
          })
        );
      }

      const payload = {
        sub: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      };

      const [accessToken, refreshToken] = await Promise.all([
        this.generateAccessToken(payload),
        this.generateRefreshToken(),
      ]);

      const hashedRefreshToken = hashToken(refreshToken);
      await firstValueFrom(
        this.developerService.send('store_refresh_token', {
          userId: user.id,
          tokenHash: hashedRefreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
      );

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 900,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          avatar: user.avatar ?? null,
          is_mentor: !!user.is_mentor,
        },
      };
    } catch (error) {
      this.logger.error(`Google login failed: ${error.message}`);
      throw error;
    }
  }

  private async generateAccessToken(payload: any): Promise<string> {
    return this.jwtService.sign(payload);
  }

  private async generateRefreshToken(): Promise<string> {
    return uuidv4();
  }

  private async logActivity(userId: string, action: string, metadata: any) {
    try {
      await firstValueFrom(
        this.developerService.send('log_user_activity', {
          userId,
          action,
          ipAddress: metadata.ip,
          userAgent: metadata.userAgent,
          deviceInfo: metadata.deviceInfo,
          timestamp: new Date()
        })
      );
    } catch (error) {
      this.logger.error(`Failed to log activity: ${error.message}`);
    }
  }
}
