import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Repository } from './repository.entity';

@Entity('github_integrations')
export class GitHubIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'github_username' })
  github_username: string;

  @Column({ name: 'github_token' })
  github_token: string;

  @CreateDateColumn({ name: 'connected_at' })
  connected_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => Repository, repository => repository.integration)
  repositories: Repository[];
}