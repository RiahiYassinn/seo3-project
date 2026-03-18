import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GitHubIntegration } from './github-integration.entity';

@Entity('github_repositories')
export class GitHubRepository {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id' })
  integrationId: string;

  @ManyToOne(() => GitHubIntegration, (integration) => integration.repositories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'integration_id' })
  integration: GitHubIntegration;

  @Column({ name: 'github_repo_id', type: 'bigint' })
  githubRepoId: number;

  @Column({ name: 'repo_name' })
  repoName: string;

  @Column({ name: 'repo_url' })
  repoUrl: string;

  @Column({ name: 'repo_description', type: 'text', default: '' })
  repoDescription: string;

  @Column({ default: 'Unknown' })
  language: string;

  @Column({ default: 0 })
  stars: number;

  @Column({ default: 0 })
  forks: number;

  @Column({ name: 'is_private', default: false })
  isPrivate: boolean;

  @Column({ name: 'default_branch', default: 'main' })
  defaultBranch: string;

  @Column({ name: 'is_analyzed', default: false })
  isAnalyzed: boolean;

  @Column({ name: 'analysis_status', nullable: true })
  analysisStatus: string; // 'pending', 'in_progress', 'completed', 'failed'

  @Column({ name: 'last_analyzed_at', nullable: true })
  lastAnalyzedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'last_synced' })
  lastSynced: Date;
}
