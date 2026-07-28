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
export type RecommendationEffort = 'light' | 'moderate' | 'intensive';
export type RecommendationOutcomeStatus = 'pending' | 'improving' | 'stalled' | 'resolved';
export type MentorshipSessionMode = 'remote' | 'onsite';

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

  @Column({ name: 'mentorship_session_scheduled_at', type: 'timestamp', nullable: true })
  mentorshipSessionScheduledAt: Date | null;

  @Column({ name: 'mentorship_session_note', type: 'text', nullable: true })
  mentorshipSessionNote: string | null;

  @Column({
    name: 'mentorship_session_mode',
    type: 'varchar',
    nullable: true,
  })
  mentorshipSessionMode: MentorshipSessionMode | null;

  /** Physical meeting point; only meaningful for on-site sessions. */
  @Column({
    name: 'mentorship_session_location',
    type: 'varchar',
    nullable: true,
  })
  mentorshipSessionLocation: string | null;

  /** Teams join URL for remote sessions, when Graph could create one. */
  @Column({
    name: 'mentorship_session_join_url',
    type: 'varchar',
    nullable: true,
  })
  mentorshipSessionJoinUrl: string | null;

  @Column({
    name: 'mentorship_session_reminder_sent_at',
    type: 'timestamp',
    nullable: true,
  })
  mentorshipSessionReminderSentAt: Date | null;

  @Column({ name: 'context_snapshot', type: 'jsonb', nullable: true })
  contextSnapshot: Record<string, any> | null;

  @Column({ name: 'evidence_snapshot', type: 'jsonb', nullable: true })
  evidenceSnapshot: Record<string, any> | null;

  @Column({ name: 'target_skills', type: 'jsonb', nullable: true })
  targetSkills: string[] | null;

  @Column({ name: 'effort_level', type: 'varchar', nullable: true })
  effortLevel: RecommendationEffort | null;

  @Column({ name: 'due_in_days', type: 'int', nullable: true })
  dueInDays: number | null;

  @Column({ name: 'confidence_score', type: 'float', nullable: true })
  confidenceScore: number | null;

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

  @Column({ name: 'previous_recommendation_id', type: 'uuid', nullable: true })
  previousRecommendationId: string | null;

  @Column({ name: 'outcome_status', type: 'varchar', nullable: true })
  outcomeStatus: RecommendationOutcomeStatus | null;

  @Column({ name: 'outcome_metrics', type: 'jsonb', nullable: true })
  outcomeMetrics: Record<string, any> | null;

  @Column({ name: 'feedback', type: 'jsonb', nullable: true })
  feedback: Record<string, any> | null;

  /** Generated validation quiz, including answer keys. Never sent to clients as-is. */
  @Column({ name: 'quiz', type: 'jsonb', nullable: true })
  quiz: Record<string, any> | null;

  @Column({ name: 'quiz_attempts', type: 'jsonb', default: () => "'[]'::jsonb" })
  quizAttempts: Array<Record<string, any>>;

  @Column({ name: 'quiz_passed_at', type: 'timestamp', nullable: true })
  quizPassedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
