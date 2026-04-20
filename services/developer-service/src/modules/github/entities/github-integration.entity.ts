import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Repository } from './repository.entity';

@Entity('github_integrations')
export class GithubIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // FK to your existing users/developers table
  @Column({ name: 'developer_id', type: 'uuid' })
  developerId: string;

  @Column({ name: 'github_username' })
  githubUsername: string;

  // Store encrypted — never return raw token to client
  @Column({ name: 'github_token_encrypted', select: false })
  githubTokenEncrypted: string;

  @Column({ name: 'connected_at', type: 'timestamptz' })
  connectedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Repository, (repo) => repo.integration, { cascade: true })
  repositories: Repository[];
}
