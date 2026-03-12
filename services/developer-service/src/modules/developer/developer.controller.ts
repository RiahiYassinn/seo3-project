import {
  Controller,
  Logger,
  Get,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DeveloperService } from './developer.service';
import { EmailService } from './email.service';

@Controller('developers')
export class DeveloperController {
  private readonly logger = new Logger(DeveloperController.name);

  constructor(
    private readonly developerService: DeveloperService,
    private readonly emailService: EmailService,
  ) {}

  // ─── HTTP endpoints ────────────────────────────────────────────────────────

  @Get()
  findAll() {
    return this.developerService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.developerService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: any) {
    return this.developerService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.developerService.remove(id);
  }

  // ─── Auth message pattern handlers ────────────────────────────────────────

  @MessagePattern('check_user_exists')
  handleCheckUserExists(@Payload() data: { email: string; username: string }) {
    return this.developerService.checkUserExists(data.email, data.username);
  }

  @MessagePattern('create_user')
  async handleCreateUser(
    @Payload()
    data: {
      email: string;
      username?: string;
      first_name: string;
      last_name: string;
      password: string;
    },
  ) {
    const dev = await this.developerService.createUser({
      email: data.email,
      username: data.username,
      firstName: data.first_name,
      lastName: data.last_name,
      password: data.password,
    });
    return this.developerService.toUserDto(dev);
  }

  @MessagePattern('find_user_by_login')
  async handleFindUserByLogin(@Payload() data: { usernameOrEmail: string }) {
    const dev = await this.developerService.findByEmailOrUsername(data.usernameOrEmail);
    if (!dev) return null;
    return this.developerService.toUserDto(dev);
  }

  @MessagePattern('find_user_by_email')
  async handleFindUserByEmail(@Payload() data: { email: string }) {
    const dev = await this.developerService.findByEmail(data.email);
    if (!dev) return null;
    return this.developerService.toUserDto(dev);
  }

  @MessagePattern('create_verification_token')
  handleCreateVerificationToken(@Payload() data: { userId: string; token: string }) {
    return this.developerService.createVerificationToken(data.userId, data.token);
  }

  @MessagePattern('verify_email')
  handleVerifyEmail(@Payload() data: { token: string }) {
    return this.developerService.verifyEmail(data.token);
  }

  @MessagePattern('send_verification_email')
  async handleSendVerificationEmail(
    @Payload() data: { email: string; name: string; token: string },
  ) {
    try {
      await this.emailService.sendVerificationEmail(data.email, data.name, data.token);
      return { sent: true };
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${data.email}: ${error.message}`);
      return { sent: false, error: error.message };
    }
  }

  @MessagePattern('send_password_reset_email')
  async handleSendPasswordResetEmail(
    @Payload() data: { email: string; name: string; token: string },
  ) {
    try {
      await this.emailService.sendPasswordResetEmail(data.email, data.name, data.token);
      return { sent: true };
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${data.email}: ${error.message}`);
      return { sent: false, error: error.message };
    }
  }

  @MessagePattern('store_refresh_token')
  handleStoreRefreshToken(
    @Payload()
    data: {
      userId: string;
      tokenHash: string;
      deviceInfo?: string;
      ipAddress?: string;
      expiresAt: Date;
    },
  ) {
    return this.developerService.storeRefreshToken(data);
  }

  @MessagePattern('find_refresh_token')
  async handleFindRefreshToken(
    @Payload() data: { userId: string; tokenHash: string },
  ) {
    const token = await this.developerService.findRefreshToken(data.userId, data.tokenHash);
    if (!token) return null;
    return {
      id: token.id,
      developer_id: token.developerId,
      token_hash: token.tokenHash,
      is_revoked: token.isRevoked,
      expires_at: token.expiresAt,
    };
  }

  @MessagePattern('rotate_refresh_token')
  handleRotateRefreshToken(
    @Payload()
    data: {
      oldTokenId: string;
      newTokenHash: string;
      userId: string;
      deviceInfo?: string;
      ipAddress?: string;
    },
  ) {
    return this.developerService.rotateRefreshToken(data);
  }

  @MessagePattern('revoke_refresh_token')
  async handleRevokeRefreshToken(@Payload() data: { tokenHash: string }) {
    await this.developerService.revokeRefreshToken(data.tokenHash);
    return { success: true };
  }

  @MessagePattern('revoke_all_user_tokens')
  async handleRevokeAllUserTokens(@Payload() data: { userId: string }) {
    await this.developerService.revokeAllUserTokens(data.userId);
    return { success: true };
  }

  @MessagePattern('update_last_login')
  async handleUpdateLastLogin(@Payload() data: { userId: string }) {
    await this.developerService.updateLastLogin(data.userId);
    return { success: true };
  }

  @MessagePattern('create_password_reset_token')
  handleCreatePasswordResetToken(
    @Payload() data: { userId: string; token: string; expiresAt: Date },
  ) {
    return this.developerService.createPasswordResetToken(
      data.userId,
      data.token,
      new Date(data.expiresAt),
    );
  }

  @MessagePattern('validate_password_reset_token')
  async handleValidatePasswordResetToken(@Payload() data: { token: string }) {
    const resetToken = await this.developerService.validatePasswordResetToken(data.token);
    if (!resetToken) return null;
    return {
      id: resetToken.id,
      user_id: resetToken.userId,
      token: resetToken.token,
      is_used: resetToken.isUsed,
      expires_at: resetToken.expiresAt,
    };
  }

  @MessagePattern('update_user_password')
  async handleUpdateUserPassword(
    @Payload() data: { userId: string; passwordHash: string },
  ) {
    await this.developerService.updatePassword(data.userId, data.passwordHash);
    return { success: true };
  }

  @MessagePattern('mark_password_reset_token_used')
  async handleMarkPasswordResetTokenUsed(@Payload() data: { token: string }) {
    await this.developerService.markPasswordResetTokenUsed(data.token);
    return { success: true };
  }

  @MessagePattern('log_user_activity')
  handleLogUserActivity(
    @Payload()
    data: {
      userId: string;
      action: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
    this.logger.log(
      `[ACTIVITY] user=${data.userId} action=${data.action} ip=${data.ipAddress ?? 'unknown'}`,
    );
    return { logged: true };
  }
}

