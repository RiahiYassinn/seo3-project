import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { In, IsNull, Not, Repository } from 'typeorm';
import {
  RecommendationCase,
  RecommendationType,
} from './entities/recommendation-case.entity';

interface AnalysisSummary {
  quality_score?: number;
  weakness_scores?: Record<string, number>;
  summary?: {
    finding_count?: number;
    critical_count?: number;
    high_count?: number;
    medium_count?: number;
    low_count?: number;
  };
  skills?: Array<{
    skill: string;
    issue_count: number;
    highest_severity: 'low' | 'medium' | 'high' | 'critical';
    average_confidence: number;
    example_titles: string[];
  }>;
  findings?: Array<{
    file_path: string;
    line: number | null;
    skill: string;
    title: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  }>;
  learning_resources?: Array<{
    skill: string;
    title: string;
    type: string;
    url: string;
  }>;
}

interface AnalysisCompletedEvent {
  repositoryId: string;
  repoName?: string;
  developerId?: string;
  requestedByUserId?: string;
  githubUsername?: string;
  analyzedAt?: string;
  summary?: AnalysisSummary;
}

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
  ) {}

  async onModuleInit() {
    await this.developerService.connect();
  }

  private isUuid(value: string | undefined | null) {
    if (!value) {
      return false;
    }

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private normalizeContributorLogin(login: string | undefined | null) {
    return String(login || '').trim().toLowerCase();
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

  private computeRiskProfile(summary: AnalysisSummary | undefined) {
    const qualityScore =
      typeof summary?.quality_score === 'number' ? summary.quality_score : 0;
    const findingCount = summary?.summary?.finding_count || 0;
    const criticalCount = summary?.summary?.critical_count || 0;
    const highCount = summary?.summary?.high_count || 0;
    const weaknessCount = Object.keys(summary?.weakness_scores || {}).length;

    const criticalRatio = findingCount > 0 ? criticalCount / findingCount : 0;
    const highRatio = findingCount > 0 ? highCount / findingCount : 0;

    const risk =
      0.45 * (1 - Math.max(0, Math.min(10, qualityScore)) / 10) +
      0.35 * criticalRatio +
      0.2 * highRatio;

    return {
      qualityScore,
      findingCount,
      criticalCount,
      highCount,
      weaknessCount,
      riskScore: Number((risk * 100).toFixed(2)),
    };
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

  private async getMentorLoadMap() {
    const rows = await this.recommendationRepo
      .createQueryBuilder('recommendation')
      .select('recommendation.mentor_id', 'mentorId')
      .addSelect('COUNT(*)::int', 'activeCount')
      .where('recommendation.recommendation_type = :type', {
        type: 'mentorship',
      })
      .andWhere('recommendation.status IN (:...statuses)', {
        statuses: ['open', 'assigned'],
      })
      .andWhere('recommendation.mentor_id IS NOT NULL')
      .groupBy('recommendation.mentor_id')
      .getRawMany<{ mentorId: string; activeCount: string }>();

    const loadMap = new Map<string, number>();
    for (const row of rows) {
      loadMap.set(row.mentorId, Number(row.activeCount || 0));
    }

    return loadMap;
  }

  private async pickMentor(candidates: MentorCandidate[]) {
    if (candidates.length === 0) {
      return null;
    }

    const loadMap = await this.getMentorLoadMap();

    const sortedCandidates = [...candidates].sort((left, right) => {
      const leftLoad = loadMap.get(left.id) || 0;
      const rightLoad = loadMap.get(right.id) || 0;
      if (leftLoad !== rightLoad) {
        return leftLoad - rightLoad;
      }

      const leftLastLogin = left.last_login_at
        ? new Date(left.last_login_at).getTime()
        : 0;
      const rightLastLogin = right.last_login_at
        ? new Date(right.last_login_at).getTime()
        : 0;

      return rightLastLogin - leftLastLogin;
    });

    return sortedCandidates[0];
  }

  private buildTopWeaknesses(summary: AnalysisSummary | undefined) {
    return Object.entries(summary?.weakness_scores || {})
      .map(([skill, score]) => ({ skill, score }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);
  }

  private buildLearningPath(summary: AnalysisSummary | undefined) {
    const topWeaknesses = this.buildTopWeaknesses(summary);
    const resources = Array.isArray(summary?.learning_resources)
      ? summary?.learning_resources
      : [];

    const steps = topWeaknesses.map((weakness, index) => {
      const relatedResources = resources
        .filter((resource) => resource.skill === weakness.skill)
        .slice(0, 2);

      return {
        order: index + 1,
        skill: weakness.skill,
        goal: `Reduce ${weakness.skill.replace(/_/g, ' ')} issues by 30%`,
        resources: relatedResources,
      };
    });

    return {
      durationWeeks: Math.max(2, steps.length * 2),
      steps,
    };
  }

  private buildDocsReview(summary: AnalysisSummary | undefined) {
    const findings = Array.isArray(summary?.findings) ? summary.findings : [];
    const priorities = { critical: 4, high: 3, medium: 2, low: 1 };

    const checklist = findings
      .sort(
        (left, right) =>
          priorities[right.severity] - priorities[left.severity] ||
          right.confidence - left.confidence,
      )
      .slice(0, 5)
      .map((finding) => ({
        title: finding.title,
        skill: finding.skill,
        file: finding.file_path,
        note: finding.message,
      }));

    return {
      checklist,
      resources: (summary?.learning_resources || []).slice(0, 4),
    };
  }

  private chooseRecommendationType(
    risk: ReturnType<typeof this.computeRiskProfile>,
    mentorAvailable: boolean,
  ): RecommendationType {
    const mentorshipNeeded =
      risk.qualityScore < 4.5 ||
      risk.criticalCount >= 2 ||
      (risk.riskScore >= 70 && risk.weaknessCount >= 3);

    if (mentorshipNeeded && mentorAvailable) {
      return 'mentorship';
    }

    if (risk.qualityScore > 7.5 && risk.criticalCount === 0 && risk.highCount <= 1) {
      return 'docs_review';
    }

    return 'learning_path';
  }

  private buildTitle(type: RecommendationType, contributorLogin: string) {
    if (type === 'mentorship') {
      return `Mentorship recommended for @${contributorLogin}`;
    }

    if (type === 'learning_path') {
      return `Learning path recommended for @${contributorLogin}`;
    }

    return `Docs-focused review recommended for @${contributorLogin}`;
  }

  private buildDescription(type: RecommendationType, riskScore: number) {
    if (type === 'mentorship') {
      return `High risk score (${riskScore}) indicates that guided mentorship will provide the fastest quality improvement.`;
    }

    if (type === 'learning_path') {
      return `A focused learning path is recommended based on weakness areas and current analysis findings.`;
    }

    return `A lightweight documentation and best-practice review should address the current issues effectively.`;
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
      learning_path: record.learningPath,
      docs_review: record.docsReview,
      weakness_snapshot: record.weaknessSnapshot,
      decision_reasons: record.decisionReasons,
      analysis_summary: record.analysisSummary,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    };
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
    } catch (error) {
      this.logger.warn(
        `Failed to fetch latest analysis snapshot for recommendation regeneration: ${error?.message || error}`,
      );
    }

    if (fallbackSummary && typeof fallbackSummary === 'object') {
      return fallbackSummary;
    }

    throw new BadRequestException(
      'No analysis summary available to regenerate this recommendation',
    );
  }

  async processAnalysisCompleted(payload: AnalysisCompletedEvent) {
    const targetDeveloperId = this.resolveTargetDeveloperId(payload);
    const contributorLogin = this.normalizeContributorLogin(payload.githubUsername);

    if (!targetDeveloperId || !payload.repositoryId || !contributorLogin) {
      return null;
    }

    const summary = payload.summary || {};
    const risk = this.computeRiskProfile(summary);
    const mentors = await this.fetchMentorCandidates();
    const mentor = await this.pickMentor(mentors);

    const recommendationType = this.chooseRecommendationType(risk, !!mentor);
    const learningPath =
      recommendationType === 'learning_path' ? this.buildLearningPath(summary) : null;
    const docsReview =
      recommendationType === 'docs_review' ? this.buildDocsReview(summary) : null;

    const shouldAssignMentor = recommendationType === 'mentorship' && !!mentor;

    const existing = await this.recommendationRepo.findOne({
      where: {
        targetDeveloperId,
        repositoryId: payload.repositoryId,
        contributorLogin,
        status: In(['open', 'assigned']),
      },
      order: { updatedAt: 'DESC' },
    });

    const recommendation = existing || this.recommendationRepo.create();
    recommendation.targetDeveloperId = targetDeveloperId;
    recommendation.repositoryId = payload.repositoryId;
    recommendation.contributorLogin = contributorLogin;
    recommendation.recommendationType = recommendationType;
    recommendation.status = shouldAssignMentor ? 'assigned' : 'open';
    recommendation.priorityScore = Math.max(1, Math.min(100, Math.round(risk.riskScore)));
    recommendation.qualityScore = risk.qualityScore;
    recommendation.title = this.buildTitle(recommendationType, contributorLogin);
    recommendation.description = this.buildDescription(
      recommendationType,
      recommendation.priorityScore,
    );
    recommendation.mentorId = shouldAssignMentor ? mentor?.id || null : null;
    recommendation.mentorSnapshot = shouldAssignMentor
      ? {
          id: mentor?.id,
          name: `${mentor?.first_name || ''} ${mentor?.last_name || ''}`.trim(),
          username: mentor?.username || null,
          email: mentor?.email || null,
          role: mentor?.role,
        }
      : null;
    recommendation.learningPath = learningPath;
    recommendation.docsReview = docsReview;
    recommendation.weaknessSnapshot = {
      topWeaknesses: this.buildTopWeaknesses(summary),
      weaknessScores: summary.weakness_scores || {},
    };
    recommendation.decisionReasons = {
      risk,
      mentorAvailable: !!mentor,
      recommendationType,
      generatedAt: new Date().toISOString(),
    };
    recommendation.analysisSummary = summary as Record<string, any>;

    const saved = await this.recommendationRepo.save(recommendation);
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

    const risk = this.computeRiskProfile(latestSummary);
    const mentors = await this.fetchMentorCandidates();
    const mentor = await this.pickMentor(mentors);

    const recommendationType = this.chooseRecommendationType(risk, !!mentor);
    const learningPath =
      recommendationType === 'learning_path'
        ? this.buildLearningPath(latestSummary)
        : null;
    const docsReview =
      recommendationType === 'docs_review' ? this.buildDocsReview(latestSummary) : null;
    const shouldAssignMentor = recommendationType === 'mentorship' && !!mentor;

    recommendation.recommendationType = recommendationType;
    recommendation.status = shouldAssignMentor ? 'assigned' : 'open';
    recommendation.priorityScore = Math.max(
      1,
      Math.min(100, Math.round(risk.riskScore)),
    );
    recommendation.qualityScore = risk.qualityScore;
    recommendation.title = this.buildTitle(
      recommendationType,
      recommendation.contributorLogin,
    );
    recommendation.description = this.buildDescription(
      recommendationType,
      recommendation.priorityScore,
    );
    recommendation.mentorId = shouldAssignMentor ? mentor?.id || null : null;
    recommendation.mentorSnapshot = shouldAssignMentor
      ? {
          id: mentor?.id,
          name: `${mentor?.first_name || ''} ${mentor?.last_name || ''}`.trim(),
          username: mentor?.username || null,
          email: mentor?.email || null,
          role: mentor?.role,
        }
      : null;
    recommendation.learningPath = learningPath;
    recommendation.docsReview = docsReview;
    recommendation.weaknessSnapshot = {
      topWeaknesses: this.buildTopWeaknesses(latestSummary),
      weaknessScores: latestSummary.weakness_scores || {},
    };
    recommendation.decisionReasons = {
      risk,
      mentorAvailable: !!mentor,
      recommendationType,
      regeneratedAt: new Date().toISOString(),
      generatedBy: 'admin_manual_regeneration',
    };
    recommendation.analysisSummary = latestSummary as Record<string, any>;

    const saved = await this.recommendationRepo.save(recommendation);
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

    const saved = await this.recommendationRepo.save(recommendation);
    return this.mapCase(saved);
  }

  async acknowledgeRecommendation(recommendationId: string, developerId: string) {
    const recommendation = await this.recommendationRepo.findOne({
      where: {
        id: recommendationId,
        targetDeveloperId: developerId,
        status: Not('dismissed'),
      },
    });

    if (!recommendation) {
      return null;
    }

    recommendation.status = 'completed';
    const saved = await this.recommendationRepo.save(recommendation);
    return this.mapCase(saved);
  }
}
