import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Developer } from './entities/developer.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';

@Injectable()
export class DeveloperService {
  constructor(
    @InjectRepository(Developer)
    private readonly developerRepository: Repository<Developer>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepository: Repository<VerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
  ) { }

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
      is_first_login: !dev.lastLoginAt,
      is_email_verified: dev.isEmailVerified,
      is_active: dev.isActive,
      last_login_at: dev.lastLoginAt,
      avatar: dev.avatar,
      bio: dev.bio,
      location: dev.location,
      website: dev.website,
      is_mentor: dev.isMentor,
      // google_id: dev.googleId,
      created_at: dev.createdAt,
      updated_at: dev.updatedAt,
    };
  }

  // ─── Basic CRUD ───────────────────────────────────────────────────────────

  async findAll(): Promise<Developer[]> {
    return this.developerRepository.find();
  }

  async findAvailableMentors(): Promise<Developer[]> {
    return this.developerRepository
      .createQueryBuilder('developer')
      .where('developer.isActive = :isActive', { isActive: true })
      .andWhere('developer.role = :techLeadRole', {
        techLeadRole: 'tech_lead',
      })
      .andWhere('developer.isMentor = :isMentor', {
        isMentor: true,
      })
      .orderBy('developer.lastLoginAt', 'DESC', 'NULLS LAST')
      .addOrderBy('developer.createdAt', 'ASC')
      .getMany();
  }

  async updateMentorAvailability(userId: string, isMentor: boolean): Promise<Developer> {
    const developer = await this.findOne(userId);

    if (developer.role !== 'tech_lead') {
      throw new BadRequestException('Only tech leads can be marked as mentors');
    }

    await this.developerRepository.update(userId, { isMentor });
    return this.findOne(userId);
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
    role?: string; // Add optional role parameter
  }): Promise<Developer> {
    // Validate role
    const validRoles = ['developer', 'tech_lead', 'admin'];
    const userRole = data.role && validRoles.includes(data.role) ? data.role : 'developer';

    const developer = this.developerRepository.create({
      email: data.email,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash: data.password,
      isEmailVerified: false,
      isActive: true,
      role: userRole, // Set the role
    });
    return this.developerRepository.save(developer);
  }

  // async createGoogleUser(data: {
  //   email: string;
  //   first_name: string;
  //   last_name: string;
  //   google_id: string;
  //   username: string;
  //   is_email_verified?: boolean;
  // }): Promise<Developer> {
  //   // Ensure username is unique
  //   let username = data.username;
  //   const existing = await this.developerRepository.findOne({ where: { username } });
  //   if (existing) {
  //     username = `${username}_${Math.random().toString(36).slice(2, 6)}`;
  //   }
  //   const developer = this.developerRepository.create({
  //     email: data.email,
  //     firstName: data.first_name,
  //     lastName: data.last_name,
  //     googleId: data.google_id,
  //     username,
  //     passwordHash: '',
  //     isEmailVerified: data.is_email_verified ?? true,
  //     isActive: true,
  //     role: 'developer',
  //   });
  //   return this.developerRepository.save(developer);
  // }

  // async linkGoogleAccount(userId: string, googleId: string): Promise<void> {
  //   await this.developerRepository.update(userId, { googleId });
  // }

  async update(id: string, updateDto: Partial<Developer>): Promise<Developer> {
    await this.findOne(id);
    await this.developerRepository.update(id, updateDto);
    return this.findOne(id);
  }

  /**
   * Self-service profile edit. Only fields a user may change about themselves:
   * role, email, and activation stay under admin control.
   */
  async updateOwnProfile(
    userId: string,
    data: {
      username?: string;
      firstName?: string;
      lastName?: string;
      bio?: string | null;
      location?: string | null;
      website?: string | null;
      avatar?: string | null;
    },
  ): Promise<Developer> {
    const developer = await this.findOne(userId);
    const updateData: Partial<Developer> = {};

    const requiredText = (value: string | undefined, label: string) => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      if (!trimmed) {
        throw new BadRequestException(`${label} cannot be empty`);
      }
      return trimmed;
    };

    const optionalText = (value: string | null | undefined) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      return value.trim() || null;
    };

    const username = requiredText(data.username, 'Username');
    if (username && username !== developer.username) {
      const existing = await this.findByEmailOrUsername(username);
      if (existing && existing.id !== userId) {
        throw new ConflictException('That username is already taken');
      }
      updateData.username = username;
    }

    const firstName = requiredText(data.firstName, 'First name');
    if (firstName) updateData.firstName = firstName;

    const lastName = requiredText(data.lastName, 'Last name');
    if (lastName) updateData.lastName = lastName;

    for (const field of ['bio', 'location', 'website'] as const) {
      const value = optionalText(data[field]);
      if (value !== undefined) {
        updateData[field] = value as string;
      }
    }

    if (data.avatar !== undefined) {
      updateData.avatar = (data.avatar?.trim() || null) as string;
    }

    if (Object.keys(updateData).length === 0) {
      return developer;
    }

    await this.developerRepository.update(userId, updateData);
    return this.findOne(userId);
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

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({
      where: { tokenHash },
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

