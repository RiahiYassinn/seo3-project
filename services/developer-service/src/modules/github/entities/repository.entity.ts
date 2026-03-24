import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GithubIntegration } from './github-integration.entity';

export type AnalysisStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

@Entity('repositories')
export class Repository {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id', type: 'uuid' })
  integrationId: string;

  @ManyToOne(() => GithubIntegration, (i) => i.repositories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'integration_id' })
  integration: GithubIntegration;

  // GitHub's own numeric ID — useful for deduplication on re-sync
  @Column({ name: 'github_repo_id', type: 'bigint' })
  githubRepoId: number;

  @Column({ name: 'repo_name' })
  repoName: string;

  @Column({ name: 'repo_url' })
  repoUrl: string;

  @Column({ name: 'repo_description', nullable: true })
  repoDescription: string | null;

  @Column({ nullable: true })
  language: string | null;

  @Column({ type: 'int', default: 0 })
  stars: number;

  @Column({ type: 'int', default: 0 })
  forks: number;

  @Column({ name: 'is_analyzed', default: false })
  isAnalyzed: boolean;

  @Column({ name: 'analysis_status', nullable: true, type: 'varchar' })
  analysisStatus: AnalysisStatus | null;

  @Column({ name: 'last_analyzed_at', type: 'timestamptz', nullable: true })
  lastAnalyzedAt: Date | null;

  @Column({ name: 'last_synced', type: 'timestamptz' })
  lastSynced: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}