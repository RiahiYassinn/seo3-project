import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Developer } from './entities/developer.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';

@Injectable()
export class DeveloperService {
  private readonly logger = new Logger(DeveloperService.name);

  constructor(
    @InjectRepository(Developer)
    private readonly developerRepository: Repository<Developer>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepository: Repository<VerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
  ) {}

  /** Serialize a Developer entity to the snake_case DTO expected by the api-gateway. */
  toUserDto(dev: Developer) {
    return {
      id: dev.id,
      email: dev.email,
      username: dev.username,
      first_name: dev.firstName,
      last_name: dev.lastName,
      password_hash: dev.passwordHash,
      role: dev.role,
      is_email_verified: dev.isEmailVerified,
      is_active: dev.isActive,
      last_login_at: dev.lastLoginAt,
      avatar: dev.avatar,
      bio: dev.bio,
      location: dev.location,
      website: dev.website,
      is_mentor: dev.isMentor,
      created_at: dev.createdAt,
      updated_at: dev.updatedAt,
    };
  }

  // ─── Basic CRUD ───────────────────────────────────────────────────────────

  async findAll(): Promise<Developer[]> {
    return this.developerRepository.find();
  }

  async findOne(id: string): Promise<Developer> {
    const developer = await this.developerRepository.findOne({ where: { id } });
    if (!developer) {
      throw new NotFoundException(`Developer with ID ${id} not found`);
    }
    return developer;
  }

  async findByEmail(email: string): Promise<Developer | null> {
    return this.developerRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<Developer | null> {
    return this.developerRepository.findOne({ where: { username } });
  }

  async findByEmailOrUsername(usernameOrEmail: string): Promise<Developer | null> {
    return this.developerRepository.findOne({
      where: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
    });
  }

  async checkUserExists(email: string, username: string): Promise<{ exists: boolean }> {
    const found = await this.developerRepository.findOne({
      where: [{ email }, { username }],
    });
    return { exists: !!found };
  }

  async createUser(data: {
    email: string;
    username?: string;
    firstName: string;
    lastName: string;
    /** already-hashed password */
    password: string;
  }): Promise<Developer> {
    const developer = this.developerRepository.create({
      email: data.email,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash: data.password,
      isEmailVerified: false,
      isActive: true,
      role: 'developer',
    });
    return this.developerRepository.save(developer);
  }

  async create(createDto: Partial<Developer>): Promise<Developer> {
    const developer = this.developerRepository.create(createDto);
    return this.developerRepository.save(developer);
  }

  async update(id: string, updateDto: Partial<Developer>): Promise<Developer> {
    await this.findOne(id);
    await this.developerRepository.update(id, updateDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const developer = await this.findOne(id);
    await this.developerRepository.remove(developer);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.developerRepository.update(userId, { lastLoginAt: new Date() });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.developerRepository.update(userId, { passwordHash });
  }

  // ─── Refresh Tokens ───────────────────────────────────────────────────────

  async storeRefreshToken(data: {
    userId: string;
    tokenHash: string;
    deviceInfo?: string;
    ipAddress?: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    const token = this.refreshTokenRepository.create({
      developerId: data.userId,
      tokenHash: data.tokenHash,
      deviceInfo: data.deviceInfo,
      ipAddress: data.ipAddress,
      expiresAt: data.expiresAt,
    });
    return this.refreshTokenRepository.save(token);
  }

  async findRefreshToken(userId: string, tokenHash: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({
      where: { developerId: userId, tokenHash, isRevoked: false },
    });
  }

  async rotateRefreshToken(data: {
    oldTokenId: string;
    newTokenHash: string;
    userId: string;
    deviceInfo?: string;
    ipAddress?: string;
  }): Promise<RefreshToken> {
    await this.refreshTokenRepository.update(data.oldTokenId, {
      isRevoked: true,
      revokedAt: new Date(),
    });
    return this.storeRefreshToken({
      userId: data.userId,
      tokenHash: data.newTokenHash,
      deviceInfo: data.deviceInfo,
      ipAddress: data.ipAddress,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { tokenHash },
      { isRevoked: true, revokedAt: new Date() },
    );
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { developerId: userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );
  }

  // ─── Email Verification ───────────────────────────────────────────────────

  async createVerificationToken(userId: string, token: string): Promise<VerificationToken> {
    // Invalidate any prior unused tokens for this user
    await this.verificationTokenRepository.update(
      { developerId: userId, isUsed: false },
      { isUsed: true },
    );
    const vToken = this.verificationTokenRepository.create({
      developerId: userId,
      token,
      isUsed: false,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 h
    });
    return this.verificationTokenRepository.save(vToken);
  }

  async verifyEmail(token: string): Promise<boolean> {
    const vToken = await this.verificationTokenRepository.findOne({
      where: { token, isUsed: false },
    });
    if (!vToken || (vToken.expiresAt && vToken.expiresAt < new Date())) {
      return false;
    }
    await this.verificationTokenRepository.update(vToken.id, { isUsed: true });
    await this.developerRepository.update(vToken.developerId, {
      isEmailVerified: true,
      isActive: true,
    });
    return true;
  }

  // ─── Password Reset ───────────────────────────────────────────────────────

  async createPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<PasswordResetToken> {
    const resetToken = this.passwordResetTokenRepository.create({
      userId,
      token,
      expiresAt,
      isUsed: false,
    });
    return this.passwordResetTokenRepository.save(resetToken);
  }

  async validatePasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    return this.passwordResetTokenRepository.findOne({
      where: { token, isUsed: false },
    });
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await this.passwordResetTokenRepository.update({ token }, { isUsed: true });
  }
}

