import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('notifications')
@Index('idx_notifications_recipient_user', ['recipientUserId'])
@Index('idx_notifications_recipient_role', ['recipientRole'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId: string | null;

  @Column({ name: 'recipient_role', nullable: true })
  recipientRole: string | null;

  @Column({ default: 'system' })
  type: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ nullable: true })
  link: string | null;

  @Column({ default: 'info' })
  priority: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date | null;

  @Column({ name: 'read_receipts', type: 'jsonb', default: () => "'{}'::jsonb" })
  readReceipts: Record<string, string>;

  @Column({ name: 'dismissals', type: 'jsonb', default: () => "'{}'::jsonb" })
  dismissals: Record<string, string>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
