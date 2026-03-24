import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { GitHubIntegration } from './github-integration.entity';

@Entity('repositories')
export class Repository {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id' })
  integrationId: string;

  @Column({ name: 'repo_id' })
  repo_id: string;

  @Column({ name: 'repo_name' })
  repo_name: string;

  @Column({ name: 'repo_url' })
  repo_url: string;

  @Column({ name: 'repo_description', type: 'text', nullable: true })
  repo_description: string;

  @Column({ nullable: true })
  language: string;

  @Column({ default: 0 })
  stars: number;

  @Column({ default: 0 })
  forks: number;

  @Column({ name: 'is_analyzed', default: false })
  is_analyzed: boolean;

  @Column({ name: 'analysis_status', nullable: true })
  analysis_status: string;

  @Column({ name: 'last_analyzed_at', nullable: true })
  last_analyzed_at: Date;

  @CreateDateColumn({ name: 'last_synced' })
  last_synced: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => GitHubIntegration, integration => integration.repositories)
  integration: GitHubIntegration;
}