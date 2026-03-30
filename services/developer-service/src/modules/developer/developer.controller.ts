import {
  Controller,
  Logger,
  Get,
  Put,
  Delete,
  Body,
  Param,
  NotFoundException,
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
  ) { }

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
      firstName: string;
      lastName: string;
      password: string;
      role?: string;
    },
  ) {
    const dev = await this.developerService.createUser({
      email: data.email,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      password: data.password,
      role: data.role,
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

  @MessagePattern('find_user_by_id')
  async handleFindUserById(@Payload() data: { id: string }) {
    const dev = await this.developerService.findOne(data.id);
    if (!dev) return null;
    const userDto = this.developerService.toUserDto(dev);
    return { ...userDto, is_active: true }; // Add is_active field for JWT validation
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

  @MessagePattern('send_credentials_email')
  async handleSendCredentialsEmail(
    @Payload() data: { email: string; name: string; username: string; password: string },
  ) {
    try {
      await this.emailService.sendCredentialsEmail(data.email, data.name, data.username, data.password);
      return { sent: true };
    } catch (error) {
      this.logger.error(`Failed to send credentials email to ${data.email}: ${error.message}`);
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

  // @MessagePattern('create_google_user')
  // async handleCreateGoogleUser(
  //   @Payload()
  //   data: {
  //     email: string;
  //     first_name: string;
  //     last_name: string;
  //     google_id: string;
  //     username: string;
  //     is_email_verified?: boolean;
  //   },
  // ) {
  //   const dev = await this.developerService.createGoogleUser(data);
  //   return this.developerService.toUserDto(dev);
  // }

  // @MessagePattern('link_google_account')
  // async handleLinkGoogleAccount(
  //   @Payload() data: { userId: string; google_id: string },
  // ) {
  //   await this.developerService.linkGoogleAccount(data.userId, data.google_id);
  //   return { success: true };
  // }

  // ─── Admin message pattern handlers ────────────────────────────────────────

  @MessagePattern('get_all_users')
  async handleGetAllUsers() {
    const developers = await this.developerService.findAll();
    const users = developers.map((dev) => this.developerService.toUserDto(dev));

    // Calculate active today (users who logged in within last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const active_today = users.filter(
      (user) => user.last_login_at && new Date(user.last_login_at) > twentyFourHoursAgo,
    ).length;

    return { users, active_today };
  }

  @MessagePattern('get_user_by_id')
  async handleGetUserById(@Payload() data: { userId: string }) {
    const dev = await this.developerService.findOne(data.userId);
    return this.developerService.toUserDto(dev);
  }

  @MessagePattern('admin_create_user')
  async handleAdminCreateUser(
    @Payload()
    data: {
      email: string;
      username: string;
      password: string;
      first_name: string;
      last_name: string;
      role: string;
    },
  ) {
    const dev = await this.developerService.createUser({
      email: data.email,
      username: data.username,
      firstName: data.first_name,
      lastName: data.last_name,
      password: data.password,
    });

    // Update role if provided
    if (data.role) {
      dev.role = data.role;
      await this.developerService.update(dev.id, { role: data.role });
    }

    return this.developerService.toUserDto(dev);
  }

  @MessagePattern('admin_update_user')
  async handleAdminUpdateUser(
    @Payload()
    data: {
      userId: string;
      email?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
      role?: string;
    },
  ) {
    const updateData: any = {};
    if (data.email) updateData.email = data.email;
    if (data.username) updateData.username = data.username;
    if (data.first_name) updateData.firstName = data.first_name;
    if (data.last_name) updateData.lastName = data.last_name;
    if (data.role) updateData.role = data.role;

    const updated = await this.developerService.update(data.userId, updateData);
    return this.developerService.toUserDto(updated);
  }

  @MessagePattern('admin_delete_user')
  async handleAdminDeleteUser(@Payload() data: { userId: string }) {
    await this.developerService.remove(data.userId);
    return { success: true };
  }

  @MessagePattern('get_user_stats')
  async handleGetUserStats() {
    const developers = await this.developerService.findAll();
    const users = developers.map((dev) => this.developerService.toUserDto(dev));

    const total = users.length;
    const admins = users.filter((user) => user.role === 'admin').length;
    const tech_leads = users.filter((user) => user.role === 'tech_lead').length;
    const developersCount = users.filter((user) => user.role === 'developer').length;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const active_today = users.filter(
      (user) => user.last_login_at && new Date(user.last_login_at) > twentyFourHoursAgo,
    ).length;

    return {
      total,
      admins,
      tech_leads,
      developers: developersCount,
      active_today,
    };
  }

  @MessagePattern('check_refresh_token_revoked')
  async handleCheckRefreshTokenRevoked(@Payload() data: { token: string }) {
    const tokenRecord = await this.developerService.findRefreshTokenByHash(data.token);
    return { isRevoked: tokenRecord?.isRevoked || false };
  }
}

