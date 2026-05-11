import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka, ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { In, IsNull, Repository } from 'typeorm';
import {
  RecommendationCase,
  RecommendationType,
} from './entities/recommendation-case.entity';
import {
  AnalysisCompletedEvent,
  AnalysisSummary,
  RecommendationGenerationResult,
  RecommendationHistorySnapshot,
} from './recommendation-rag.types';
import { RagLearningPathService } from './rag-learning-path.service';

interface MentorCandidate {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_mentor: boolean;
  is_active: boolean;
  last_login_at?: string | null;
}

@Injectable()
export class RecommendationService implements OnModuleInit {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @InjectRepository(RecommendationCase)
    private readonly recommendationRepo: Repository<RecommendationCase>,
    @Inject('DEVELOPER_SERVICE')
    private readonly developerService: ClientProxy,
    @Inject('RECOMMENDATION_EVENTS_CLIENT')
    private readonly eventClient: ClientKafka,
    private readonly ragLearningPathService: RagLearningPathService,
  ) {}

  async onModuleInit() {
    await this.developerService.connect();
    await this.eventClient.connect();
  }

  async processAnalysisCompleted(payload: AnalysisCompletedEvent) {
    const targetDeveloperId = this.resolveTargetDeveloperId(payload);
    if (!targetDeveloperId || !payload.repositoryId) {
      return null;
    }

    const summary = (payload.summary || {}) as AnalysisSummary;
    const contributorLogin = this.resolveContributorLogin(payload, targetDeveloperId);
    const history = await this.getRecommendationHistory(
      targetDeveloperId,
      contributorLogin,
      payload.repositoryId,
    );
    const existing = await this.recommendationRepo.findOne({
      where: {
        targetDeveloperId,
        repositoryId: payload.repositoryId,
        contributorLogin,
        status: In(['open', 'assigned']),
      },
      order: { updatedAt: 'DESC' },
    });

    const generated = await this.ragLearningPathService.generateRecommendation(
      payload,
      summary,
    );

    const saved = await this.saveRecommendation({
      existing,
      targetDeveloperId,
      contributorLogin,
      repositoryId: payload.repositoryId,
      repoName: payload.repoName || 'Repository',
      summary,
      history,
      generated,
      analyzedAt: payload.analyzedAt,
    });

    this.emitNotificationEvent(saved, generated);
    return this.mapCase(saved);
  }

  async generateRecommendationForContributor(
    developerId: string,
    repositoryId: string,
    contributorLogin: string,
  ) {
    const normalizedLogin = this.normalizeContributorLogin(contributorLogin);
    if (!developerId || !repositoryId || !normalizedLogin) {
      throw new BadRequestException('Developer, repository, and contributor are required');
    }

    const repository = await firstValueFrom(
      this.developerService.send('github_get_repository', {
        userId: developerId,
        repositoryId,
      }),
    );

    if (!repository) {
      throw new BadRequestException('Repository not found');
    }

    const contributorProfiles =
      repository?.analysis_metadata?.contributorProfiles || {};
    const profile = contributorProfiles[normalizedLogin] || null;
    const latestSummary =
      profile?.analysisSummary ||
      profile?.analysis_summary ||
      repository?.analysis_summary ||
      null;

    if (!latestSummary || typeof latestSummary !== 'object') {
      throw new BadRequestException(
        'No analysis summary found for this contributor profile',
      );
    }

    const history = await this.getRecommendationHistory(
      developerId,
      normalizedLogin,
      repositoryId,
    );
    const existing = await this.recommendationRepo.findOne({
      where: {
        targetDeveloperId: developerId,
        repositoryId,
        contributorLogin: normalizedLogin,
        status: In(['open', 'assigned']),
      },
      order: { updatedAt: 'DESC' },
    });
    const payload: AnalysisCompletedEvent = {
      repositoryId,
      repoName:
        repository?.repo_name ||
        repository?.repoName ||
        profile?.repositoryName ||
        'Repository',
      developerId,
      requestedByUserId: developerId,
      githubUsername: normalizedLogin,
      analyzedAt: new Date().toISOString(),
      summary: latestSummary as AnalysisSummary,
    };

    const generated = await this.ragLearningPathService.generateRecommendation(
      payload,
      latestSummary as AnalysisSummary,
    );

    const saved = await this.saveRecommendation({
      existing,
      targetDeveloperId: developerId,
      contributorLogin: normalizedLogin,
      repositoryId,
      repoName: payload.repoName || 'Repository',
      summary: latestSummary as AnalysisSummary,
      history,
      generated,
      analyzedAt: payload.analyzedAt,
    });

    this.emitNotificationEvent(saved, generated);
    return this.mapCase(saved);
  }

  async regenerateRecommendation(recommendationId: string) {
    const recommendation = await this.recommendationRepo.findOne({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new BadRequestException('Recommendation not found');
    }

    const latestSummary = await this.fetchLatestAnalysisSummary(
      recommendation.targetDeveloperId,
      recommendation.repositoryId,
      recommendation.contributorLogin,
      recommendation.analysisSummary as AnalysisSummary | null,
    );
    const history = await this.getRecommendationHistory(
      recommendation.targetDeveloperId,
      recommendation.contributorLogin,
      recommendation.repositoryId,
    );
    const payload: AnalysisCompletedEvent = {
      repositoryId: recommendation.repositoryId,
      repoName: recommendation.contextSnapshot?.repoName || 'Repository',
      developerId: recommendation.targetDeveloperId,
      requestedByUserId: recommendation.targetDeveloperId,
      githubUsername: recommendation.contributorLogin,
      analyzedAt: new Date().toISOString(),
      summary: latestSummary,
      detectedGaps: Array.isArray(recommendation.contextSnapshot?.detectedGaps)
        ? recommendation.contextSnapshot?.detectedGaps.map((item: any) => item.label || item)
        : undefined,
    };

    const generated = await this.ragLearningPathService.generateRecommendation(
      payload,
      latestSummary,
    );

    const saved = await this.saveRecommendation({
      existing: recommendation,
      targetDeveloperId: recommendation.targetDeveloperId,
      contributorLogin: recommendation.contributorLogin,
      repositoryId: recommendation.repositoryId,
      repoName: recommendation.contextSnapshot?.repoName || 'Repository',
      summary: latestSummary,
      history: history.filter((item) => item.id !== recommendation.id),
      generated,
      analyzedAt: payload.analyzedAt,
    });

    this.emitNotificationEvent(saved, generated, true);
    return this.mapCase(saved);
  }

  async getRecommendationsForDeveloper(developerId: string) {
    const cases = await this.recommendationRepo.find({
      where: { targetDeveloperId: developerId },
      order: { priorityScore: 'DESC', createdAt: 'DESC' },
    });

    return cases.map((item) => this.mapCase(item));
  }

  async getRecommendationsForContributorLogin(contributorLogin: string) {
    const normalizedLogin = this.normalizeContributorLogin(contributorLogin);
    if (!normalizedLogin) {
      return [];
    }

    const cases = await this.recommendationRepo.find({
      where: { contributorLogin: normalizedLogin },
      order: { priorityScore: 'DESC', createdAt: 'DESC' },
    });

    return cases.map((item) => this.mapCase(item));
  }

  async getRecommendationsForRepository(developerId: string, repositoryId: string) {
    const cases = await this.recommendationRepo.find({
      where: { targetDeveloperId: developerId, repositoryId },
      order: { priorityScore: 'DESC', createdAt: 'DESC' },
    });

    return cases.map((item) => this.mapCase(item));
  }

  async getRecommendationForContributor(
    developerId: string,
    repositoryId: string,
    contributorLogin: string,
  ) {
    const record = await this.recommendationRepo.findOne({
      where: {
        targetDeveloperId: developerId,
        repositoryId,
        contributorLogin: this.normalizeContributorLogin(contributorLogin),
      },
      order: { updatedAt: 'DESC' },
    });

    return record ? this.mapCase(record) : null;
  }

  async getMentorQueue(mentorId: string) {
    const queue = await this.recommendationRepo.find({
      where: [
        {
          recommendationType: 'mentorship',
          status: 'open',
          mentorId: IsNull(),
        },
        {
          recommendationType: 'mentorship',
          mentorId,
          status: In(['open', 'assigned']),
        },
      ],
      order: { priorityScore: 'DESC', createdAt: 'DESC' },
    });

    return queue.map((item) => this.mapCase(item));
  }

  async assignMentor(recommendationId: string, mentorId: string) {
    const recommendation = await this.recommendationRepo.findOne({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      return null;
    }

    const mentors = await this.fetchMentorCandidates();
    const mentor = mentors.find((candidate) => candidate.id === mentorId);

    if (!mentor) {
      throw new BadRequestException(
        'Mentor must be an active tech lead with mentor flag enabled',
      );
    }

    recommendation.mentorId = mentorId;
    recommendation.mentorSnapshot = {
      id: mentor.id,
      name: `${mentor.first_name || ''} ${mentor.last_name || ''}`.trim(),
      username: mentor.username || null,
      email: mentor.email,
      role: mentor.role,
    };
    recommendation.status = 'assigned';
    recommendation.recommendationType = 'mentorship';

    const saved = await this.recommendationRepo.save(recommendation);
    return this.mapCase(saved);
  }

  async acknowledgeRecommendation(recommendationId: string, developerId: string) {
    const recommendation = await this.recommendationRepo.findOne({
      where: {
        id: recommendationId,
        targetDeveloperId: developerId,
      },
    });

    if (!recommendation) {
      throw new BadRequestException('Recommendation not found');
    }

    recommendation.status = 'completed';
    recommendation.outcomeStatus = 'resolved';
    recommendation.outcomeMetrics = {
      ...(recommendation.outcomeMetrics || {}),
      completedAt: new Date().toISOString(),
    };

    const saved = await this.recommendationRepo.save(recommendation);
    return this.mapCase(saved);
  }

  private async saveRecommendation(params: {
    existing: RecommendationCase | null;
    targetDeveloperId: string;
    contributorLogin: string;
    repositoryId: string;
    repoName: string;
    summary: AnalysisSummary;
    history: RecommendationHistorySnapshot[];
    generated: RecommendationGenerationResult;
    analyzedAt?: string;
  }) {
    const recommendation =
      params.existing || this.recommendationRepo.create();
    const generatedAt = params.analyzedAt || new Date().toISOString();
    const priorityScore = this.computePriorityScore(
      params.summary,
      params.generated,
    );
    const qualityScore =
      typeof params.summary.quality_score === 'number'
        ? params.summary.quality_score
        : null;

    recommendation.targetDeveloperId = params.targetDeveloperId;
    recommendation.repositoryId = params.repositoryId;
    recommendation.contributorLogin = params.contributorLogin;
    recommendation.recommendationType = 'learning_path';
    recommendation.status = 'open';
    recommendation.priorityScore = priorityScore;
    recommendation.qualityScore = qualityScore;
    recommendation.title = params.generated.generatedPath.title;
    recommendation.description = params.generated.generatedPath.summary;
    recommendation.mentorId = null;
    recommendation.mentorSnapshot = null;
    recommendation.contextSnapshot = this.buildContextSnapshot(
      params,
      generatedAt,
    );
    recommendation.evidenceSnapshot = this.buildEvidenceSnapshot(
      params.generated,
      params.summary,
    );
    recommendation.targetSkills = params.generated.detectedGaps.map(
      (gap) => gap.label,
    );
    recommendation.effortLevel =
      (params.summary.summary?.critical_count || 0) > 0 ? 'intensive' : 'moderate';
    recommendation.dueInDays =
      (params.summary.summary?.critical_count || 0) > 0 ? 10 : 21;
    recommendation.confidenceScore = this.computeConfidenceScore(params.generated);
    recommendation.learningPath = {
      overview: params.generated.generatedPath.summary,
      tone: params.generated.generatedPath.tone,
      estimatedTotalHours: params.generated.generatedPath.estimated_total_hours,
      steps: params.generated.generatedPath.steps,
    };
    recommendation.docsReview = null;
    recommendation.weaknessSnapshot = {
      topWeaknesses: params.generated.detectedGaps.map((gap) => ({
        skill: gap.label,
        score: gap.score,
      })),
      weaknessScores: params.summary.weakness_scores || {},
    };
    recommendation.decisionReasons = {
      pipeline: 'atlas_vector_rag',
      llm: {
        provider: params.generated.provider,
        model: params.generated.model,
      },
      generatedAt,
      gaps: params.generated.detectedGaps,
      courseMatches: params.generated.gapMatches.map((match) => ({
        gap: match.gap.label,
        courseCount: match.courses.length,
        courseIds: match.courses.map((course) => course.courseId),
      })),
    };
    recommendation.analysisSummary = params.summary as Record<string, any>;
    recommendation.previousRecommendationId =
      params.history.find((item) => item.id !== recommendation.id)?.id || null;
    recommendation.outcomeStatus = 'pending';
    recommendation.outcomeMetrics = {
      lastGeneratedAt: generatedAt,
      previousRecommendationCount: params.history.length,
      detectedGapCount: params.generated.detectedGaps.length,
      llmProvider: params.generated.provider,
      llmModel: params.generated.model,
    };

    return this.recommendationRepo.save(recommendation);
  }

  private buildContextSnapshot(
    params: {
      repoName: string;
      contributorLogin: string;
      summary: AnalysisSummary;
      generated: RecommendationGenerationResult;
    },
    generatedAt: string,
  ) {
    return {
      repoName: params.repoName,
      contributorLogin: params.contributorLogin,
      dominantLanguage: params.summary.dominant_language || null,
      commitTopics: Array.isArray(params.summary.commit_topics)
        ? params.summary.commit_topics
        : [],
      strengths: Array.isArray(params.summary.strengths)
        ? params.summary.strengths
        : [],
      detectedGaps: params.generated.detectedGaps,
      llmProvider: params.generated.provider,
      llmModel: params.generated.model,
      generatedAt,
      profileSignals: params.summary.analysis_metadata?.skill_profile_inputs || {},
    };
  }

  private buildEvidenceSnapshot(
    generated: RecommendationGenerationResult,
    summary: AnalysisSummary,
  ) {
    return {
      recommendationType: 'learning_path',
      topWeaknesses: generated.detectedGaps.map((gap) => ({
        skill: gap.label,
        score: gap.score,
      })),
      keyFindings: (summary.findings || []).slice(0, 6).map((finding) => ({
        title: finding.title,
        skill: finding.skill,
        severity: finding.severity,
        confidence: finding.confidence,
        file: finding.file_path,
      })),
      strengths: Array.isArray(summary.strengths) ? summary.strengths.slice(0, 5) : [],
      successCriteria: generated.generatedPath.steps.map(
        (step) => step.success_signal,
      ),
      retrievedCoursesByGap: generated.gapMatches.map((match) => ({
        gapKey: match.gap.key,
        gapLabel: match.gap.label,
        courses: match.courses,
      })),
    };
  }

  private computePriorityScore(
    summary: AnalysisSummary,
    generated: RecommendationGenerationResult,
  ) {
    const counts = summary.summary || {};
    const critical = counts.critical_count || 0;
    const high = counts.high_count || 0;
    const gapWeight = generated.detectedGaps.reduce(
      (total, gap) => total + Math.min(12, gap.score * 1.6),
      0,
    );

    return Math.max(
      10,
      Math.min(100, Math.round(28 + critical * 18 + high * 10 + gapWeight)),
    );
  }

  private computeConfidenceScore(generated: RecommendationGenerationResult) {
    const matchCoverage =
      generated.gapMatches.length === 0
        ? 0
        : generated.gapMatches.filter((match) => match.courses.length > 0).length /
          generated.gapMatches.length;
    const providerPenalty = generated.provider === 'fallback' ? 0.08 : 0;
    return Number(
      Math.max(0.5, Math.min(0.94, 0.58 + matchCoverage * 0.24 - providerPenalty)).toFixed(2),
    );
  }

  private emitNotificationEvent(
    recommendation: RecommendationCase,
    generated: RecommendationGenerationResult,
    regenerated = false,
  ) {
    this.eventClient.emit('notification.sent', {
      type: 'learning_path_ready',
      recommendationId: recommendation.id,
      developerId: recommendation.targetDeveloperId,
      repositoryId: recommendation.repositoryId,
      contributorLogin: recommendation.contributorLogin,
      title: recommendation.title,
      summary: generated.notificationSummary,
      regenerated,
      createdAt: new Date().toISOString(),
    });
  }

  private async fetchLatestAnalysisSummary(
    targetDeveloperId: string,
    repositoryId: string,
    contributorLogin: string,
    fallbackSummary: AnalysisSummary | null | undefined,
  ): Promise<AnalysisSummary> {
    try {
      const repository = await firstValueFrom(
        this.developerService.send('github_get_repository', {
          userId: targetDeveloperId,
          repositoryId,
        }),
      );

      const normalizedLogin = this.normalizeContributorLogin(contributorLogin);
      const contributorProfiles =
        repository?.analysis_metadata?.contributorProfiles || {};
      const profile = contributorProfiles[normalizedLogin] || null;

      const profileSummary =
        profile?.analysisSummary ||
        profile?.analysis_summary ||
        repository?.analysis_summary ||
        null;

      if (profileSummary && typeof profileSummary === 'object') {
        return profileSummary as AnalysisSummary;
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to fetch latest analysis snapshot for regeneration: ${error?.message || error}`,
      );
    }

    if (fallbackSummary && typeof fallbackSummary === 'object') {
      return fallbackSummary;
    }

    throw new BadRequestException(
      'No analysis summary available to regenerate this recommendation',
    );
  }

  private async getRecommendationHistory(
    targetDeveloperId: string,
    contributorLogin: string,
    repositoryId: string,
  ): Promise<RecommendationHistorySnapshot[]> {
    const rows = await this.recommendationRepo.find({
      where: {
        targetDeveloperId,
        contributorLogin,
        repositoryId,
      },
      order: { createdAt: 'DESC' },
      take: 8,
    });

    return rows.map((row) => ({
      id: row.id,
      recommendationType: row.recommendationType,
      status: row.status,
      qualityScore: row.qualityScore,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async fetchMentorCandidates(): Promise<MentorCandidate[]> {
    try {
      const response = await firstValueFrom(
        this.developerService.send('developer_get_available_mentors', {}),
      );

      if (!Array.isArray(response)) {
        return [];
      }

      return response.filter(
        (mentor) =>
          mentor?.is_active &&
          mentor?.role === 'tech_lead' &&
          mentor?.is_mentor === true,
      );
    } catch (error) {
      this.logger.warn('Could not fetch mentor candidates from developer-service');
      return [];
    }
  }

  private mapCase(record: RecommendationCase) {
    return {
      id: record.id,
      target_developer_id: record.targetDeveloperId,
      repository_id: record.repositoryId,
      contributor_login: record.contributorLogin,
      recommendation_type: record.recommendationType,
      status: record.status,
      priority_score: record.priorityScore,
      quality_score: record.qualityScore,
      title: record.title,
      description: record.description,
      mentor_id: record.mentorId,
      mentor_snapshot: record.mentorSnapshot,
      context_snapshot: record.contextSnapshot,
      evidence_snapshot: record.evidenceSnapshot,
      target_skills: record.targetSkills,
      effort_level: record.effortLevel,
      due_in_days: record.dueInDays,
      confidence_score: record.confidenceScore,
      learning_path: record.learningPath,
      docs_review: record.docsReview,
      weakness_snapshot: record.weaknessSnapshot,
      decision_reasons: record.decisionReasons,
      analysis_summary: record.analysisSummary,
      previous_recommendation_id: record.previousRecommendationId,
      outcome_status: record.outcomeStatus,
      outcome_metrics: record.outcomeMetrics,
      feedback: record.feedback,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    };
  }

  private resolveTargetDeveloperId(payload: AnalysisCompletedEvent): string | null {
    if (this.isUuid(payload.requestedByUserId)) {
      return payload.requestedByUserId as string;
    }

    if (this.isUuid(payload.developerId)) {
      return payload.developerId as string;
    }

    return null;
  }

  private resolveContributorLogin(
    payload: AnalysisCompletedEvent,
    developerId: string,
  ) {
    const normalized = this.normalizeContributorLogin(payload.githubUsername);
    if (normalized) {
      return normalized;
    }

    return `developer-${developerId.slice(0, 8)}`;
  }

  private normalizeContributorLogin(login: string | undefined | null) {
    return String(login || '').trim().toLowerCase();
  }

  private isUuid(value: string | undefined | null) {
    if (!value) {
      return false;
    }

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
