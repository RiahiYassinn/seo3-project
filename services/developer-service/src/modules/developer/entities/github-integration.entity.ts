import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Developer } from './developer.entity';
import { GitHubRepository } from './github-repository.entity';

@Entity('github_integrations')
export class GitHubIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'developer_id' })
  developerId: string;

  @ManyToOne(() => Developer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;

  @Column({ name: 'github_username' })
  githubUsername: string;

  @Column({ name: 'github_token', type: 'text' })
  githubToken: string;

  @Column({ name: 'github_id', type: 'bigint' })
  githubId: number;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @OneToMany(() => GitHubRepository, (repo) => repo.integration)
  repositories: GitHubRepository[];

  @CreateDateColumn({ name: 'connected_at' })
  connectedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
