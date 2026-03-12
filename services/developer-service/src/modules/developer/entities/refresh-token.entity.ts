import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Developer } from './developer.entity';

@Entity('developer_refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'developer_id' })
  developerId: string;

  @ManyToOne(() => Developer, (dev) => dev.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;

  @Column({ name: 'token_hash', length: 255 })
  tokenHash: string;

  @Column({ name: 'device_info', type: 'text', nullable: true })
  deviceInfo: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date;
}
