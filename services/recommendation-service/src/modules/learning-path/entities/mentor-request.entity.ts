import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type MentorRequestStatus = "pending" | "accepted" | "declined";

@Entity("mentor_requests")
@Index("idx_mentor_requests_mentor_status", ["mentorId", "status"])
@Index("idx_mentor_requests_recommendation_status", [
  "recommendationId",
  "status",
])
export class MentorRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "recommendation_id", type: "uuid" })
  recommendationId: string;

  @Column({ name: "requester_developer_id", type: "uuid" })
  requesterDeveloperId: string;

  @Column({ name: "mentor_id", type: "uuid" })
  mentorId: string;

  @Column({ type: "varchar", default: "pending" })
  status: MentorRequestStatus;

  @Column({ name: "mentor_snapshot", type: "jsonb", nullable: true })
  mentorSnapshot: Record<string, any> | null;

  @Column({ name: "requester_snapshot", type: "jsonb", nullable: true })
  requesterSnapshot: Record<string, any> | null;

  @Column({ name: "responded_at", type: "timestamp", nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
