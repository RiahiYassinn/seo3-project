import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { GithubService } from './github.service';

interface AnalysisCompletionPayload {
  repositoryId: string;
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

    const summary = (message.summary || null) as Record<string, any> | null;
    const metadata = (message.metadata || null) as Record<string, any> | null;
    const detectedSkills = Array.isArray(summary?.skills)
      ? (summary?.skills as Record<string, any>[])
      : null;
    const mergedMetadata = {
      ...(metadata || {}),
      ...(summary?.analysis_metadata
        ? { nlpAnalysisMetadata: summary.analysis_metadata }
        : {}),
    };

    await this.githubService.updateRepositoryAnalysis(message.repositoryId, {
      status: 'completed',
      progress: 100,
      stage: 'Weakness analysis completed',
      summary,
      detectedSkills,
      metadata: mergedMetadata,
    });
  }

  @EventPattern('analysis.failed')
  async handleFailed(@Payload() payload: AnalysisCompletionPayload) {
    const message = this.unwrapPayload(payload);
    if (!message?.repositoryId) {
      return;
    }

    await this.githubService.updateRepositoryAnalysis(message.repositoryId, {
      status: 'failed',
      progress: message.progress ?? 100,
      stage: message.stage || 'Analysis failed',
      failureReason: message.reason || 'Unknown analysis failure',
    });
  }

  @EventPattern('analysis.progress')
  async handleProgress(@Payload() payload: AnalysisCompletionPayload) {
    const message = this.unwrapPayload(payload);
    if (!message?.repositoryId) {
      return;
    }

    await this.githubService.updateRepositoryAnalysis(message.repositoryId, {
      status: 'in_progress',
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
