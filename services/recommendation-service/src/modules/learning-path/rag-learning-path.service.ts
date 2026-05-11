import { Injectable } from '@nestjs/common';
import { CourseCatalogService } from './course-catalog.service';
import { LlmClientService } from './llm-client.service';
import {
  AnalysisCompletedEvent,
  AnalysisSummary,
  DetectedGap,
  GapCourseMatch,
  RecommendationGenerationResult,
} from './recommendation-rag.types';

@Injectable()
export class RagLearningPathService {
  private readonly gapLabelMap: Record<string, string> = {
    async_error_handling: 'Async reliability and API error handling',
    python_error_handling: 'Python exception handling discipline',
    type_safety: 'TypeScript type safety and safer contracts',
    testing_reliability: 'Testing strategy and regression prevention',
    documentation_readability: 'Code readability and technical documentation',
    api_service_design: 'Backend API and service design',
    security_secrets_auth: 'Security hygiene and auth hardening',
    code_maintainability: 'Maintainability and refactoring discipline',
  };

  constructor(
    private readonly courseCatalogService: CourseCatalogService,
    private readonly llmClientService: LlmClientService,
  ) {}

  async generateRecommendation(
    payload: AnalysisCompletedEvent,
    summary: AnalysisSummary,
  ): Promise<RecommendationGenerationResult> {
    const detectedGaps = this.deriveDetectedGaps(payload, summary);
    const gapMatches: GapCourseMatch[] = [];

    for (const gap of detectedGaps.slice(0, 4)) {
      const courses = await this.courseCatalogService.findTopCoursesForGap(
        gap.label,
        3,
      );
      gapMatches.push({ gap, courses });
    }

    const generated = await this.llmClientService.generateLearningPath({
      developerLabel:
        payload.githubUsername || payload.developerId || payload.requestedByUserId || 'developer',
      repoName: payload.repoName || 'Repository',
      dominantLanguage: summary.dominant_language || null,
      commitTopics: Array.isArray(summary.commit_topics) ? summary.commit_topics : [],
      strengths: Array.isArray(summary.strengths) ? summary.strengths : [],
      detectedGaps,
      matches: gapMatches,
    });

    const hydratedPath = await this.courseCatalogService.hydrateRecommendedCourses(
      generated.learningPath,
      gapMatches,
    );

    return {
      detectedGaps,
      gapMatches,
      generatedPath:
        hydratedPath as unknown as RecommendationGenerationResult['generatedPath'],
      provider: generated.provider,
      model: generated.model,
      notificationSummary: hydratedPath.steps
        .slice(0, 2)
        .map((step: any) => step.title)
        .join(' -> '),
    };
  }

  private deriveDetectedGaps(
    payload: AnalysisCompletedEvent,
    summary: AnalysisSummary,
  ): DetectedGap[] {
    const explicitGaps = Array.isArray(payload.detectedGaps)
      ? payload.detectedGaps.filter((item) => typeof item === 'string' && item.trim())
      : [];

    if (explicitGaps.length > 0) {
      return explicitGaps.slice(0, 4).map((gap, index) => ({
        key: this.slugify(gap),
        label: gap.trim(),
        score: Math.max(5, 10 - index),
        severity: index === 0 ? 'high' : 'medium',
        evidence: [],
      }));
    }

    const weaknessScores = summary.weakness_scores || {};
    const findings = Array.isArray(summary.findings) ? summary.findings : [];
    const sortedWeaknesses = Object.entries(weaknessScores)
      .map(([key, score]) => ({
        key,
        label: this.gapLabelMap[key] || this.humanize(key),
        score: typeof score === 'number' ? score : Number(score || 0),
        evidence: findings
          .filter((finding) => finding.skill === key)
          .slice(0, 2)
          .map((finding) => finding.title || finding.message),
        severity: this.pickSeverity(
          findings
            .filter((finding) => finding.skill === key)
            .map((finding) => finding.severity),
        ),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);

    if (sortedWeaknesses.length > 0) {
      return sortedWeaknesses;
    }

    const skillFallback = Array.isArray(summary.skills) ? summary.skills : [];
    return skillFallback.slice(0, 4).map((skill) => ({
      key: this.slugify(skill.skill),
      label: this.humanize(skill.skill),
      score: Math.max(1, skill.issue_count || 1),
      severity: skill.highest_severity,
      evidence: Array.isArray(skill.example_titles) ? skill.example_titles.slice(0, 2) : [],
    }));
  }

  private pickSeverity(
    severities: Array<'low' | 'medium' | 'high' | 'critical'>,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }

  private humanize(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
