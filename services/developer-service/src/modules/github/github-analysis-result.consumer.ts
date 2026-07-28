import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { GithubService } from './github.service';

interface AnalysisCompletionPayload {
  repositoryId: string;
  developerId?: string;
  githubUsername?: string;
  repoName?: string;
  summary?: Record<string, any>;
  metadata?: Record<string, any>;
  progress?: number;
  stage?: string | null;
  reason?: string;
}

@Controller()
export class GithubAnalysisResultConsumer {
  constructor(private readonly githubService: GithubService) {}

  @EventPattern('analysis.completed')
  async handleCompleted(@Payload() payload: AnalysisCompletionPayload) {
    const message = this.unwrapPayload(payload);
    if (!message?.repositoryId) {
      return;
    }
    await this.githubService.handleContributorCompleted({
      repositoryId: message.repositoryId,
      developerId: message.developerId || '',
      repoName: message.repoName,
      githubUsername: message.githubUsername,
      summary: message.summary,
      metadata: message.metadata,
      analyzedAt: (message as any).analyzedAt,
    });
  }

  @EventPattern('analysis.failed')
  async handleFailed(@Payload() payload: AnalysisCompletionPayload) {
    const message = this.unwrapPayload(payload);
    if (!message?.repositoryId) {
      return;
    }

    await this.githubService.handleContributorFailed({
      repositoryId: message.repositoryId,
      githubUsername: message.githubUsername,
      reason: message.reason,
      progress: message.progress ?? 100,
      stage: message.stage || 'Analysis failed',
    });
  }

  @EventPattern('analysis.progress')
  async handleProgress(@Payload() payload: AnalysisCompletionPayload) {
    const message = this.unwrapPayload(payload);
    if (!message?.repositoryId) {
      return;
    }

    await this.githubService.handleContributorProgress({
      repositoryId: message.repositoryId,
      githubUsername: message.githubUsername,
      progress: message.progress ?? 0,
      stage: message.stage || 'Analysis in progress',
    });
  }

  private unwrapPayload(payload: any): AnalysisCompletionPayload | null {
    if (!payload) {
      return null;
    }

    const rawValue = payload.value ?? payload;
    if (typeof rawValue === 'string') {
      return JSON.parse(rawValue);
    }

    if (Buffer.isBuffer(rawValue)) {
      return JSON.parse(rawValue.toString('utf8'));
    }

    return rawValue;
  }
}
