import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type RecommendationType = 'mentorship' | 'learning_path' | 'docs_review';
export type RecommendationStatus = 'open' | 'assigned' | 'completed' | 'dismissed';

@Entity('recommendation_cases')
@Index('idx_recommendation_cases_target_repo', ['targetDeveloperId', 'repositoryId'])
@Index('idx_recommendation_cases_mentor_status', ['mentorId', 'status'])
export class RecommendationCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'target_developer_id', type: 'uuid' })
  targetDeveloperId: string;

  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId: string;

  @Column({ name: 'contributor_login', type: 'varchar' })
  contributorLogin: string;

  @Column({ name: 'recommendation_type', type: 'varchar' })
  recommendationType: RecommendationType;

  @Column({ type: 'varchar' })
  status: RecommendationStatus;

  @Column({ name: 'priority_score', type: 'int', default: 0 })
  priorityScore: number;

  @Column({ name: 'quality_score', type: 'float', nullable: true })
  qualityScore: number | null;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'mentor_id', type: 'uuid', nullable: true })
  mentorId: string | null;

  @Column({ name: 'mentor_snapshot', type: 'jsonb', nullable: true })
  mentorSnapshot: Record<string, any> | null;

  @Column({ name: 'learning_path', type: 'jsonb', nullable: true })
  learningPath: Record<string, any> | null;

  @Column({ name: 'docs_review', type: 'jsonb', nullable: true })
  docsReview: Record<string, any> | null;

  @Column({ name: 'weakness_snapshot', type: 'jsonb', nullable: true })
  weaknessSnapshot: Record<string, any> | null;

  @Column({ name: 'decision_reasons', type: 'jsonb', nullable: true })
  decisionReasons: Record<string, any> | null;

  @Column({ name: 'analysis_summary', type: 'jsonb', nullable: true })
  analysisSummary: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
