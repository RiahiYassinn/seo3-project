import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Skill, DeveloperSkill } from './schemas/skill.schema';

interface AnalysisCompletedEvent {
  repositoryId: string;
  developerId?: string;
  requestedByUserId?: string;
  repoName: string;
  analyzedAt?: string;
  summary: {
    weakness_scores: Record<string, number>;
    top_weaknesses?: Array<{
      category: string;
      score: number;
      evidence: string[];
      priority: string;
    }>;
    strengths?: string[];
    quality_score: number | null;
    skill_level?: string;
    recommendations?: Array<{
      weakness: string;
      action: string;
      learning_query: string;
    }>;
    skills?: Array<{
      skill: string;
      issue_count: number;
      highest_severity: 'low' | 'medium' | 'high' | 'critical';
      average_confidence: number;
      example_titles: string[];
    }>;
    learning_resources?: Array<{
      skill: string;
      title: string;
      type: string;
      url: string;
    }>;
  };
  metadata?: Record<string, any>;
}

@Injectable()
export class SkillService {
  constructor(
    @InjectModel(Skill.name) private skillModel: Model<Skill>,
    @InjectModel(DeveloperSkill.name) private developerSkillModel: Model<DeveloperSkill>,
  ) {}

  async findAll(): Promise<Skill[]> {
    return this.skillModel.find().exec();
  }

  async getDeveloperSkills(developerId: string): Promise<DeveloperSkill[]> {
    return this.developerSkillModel.find({ developerId }).exec();
  }

  async updateDeveloperSkill(developerId: string, skillName: string, data: Partial<DeveloperSkill>) {
    return this.developerSkillModel.findOneAndUpdate(
      { developerId, skillName },
      { $set: data },
      { new: true, upsert: true },
    ).exec();
  }

  private resolveDeveloperId(event: AnalysisCompletedEvent): string | null {
    return event.requestedByUserId || event.developerId || null;
  }

  private normalizeTopWeaknesses(summary: AnalysisCompletedEvent['summary']) {
    if (Array.isArray(summary.top_weaknesses) && summary.top_weaknesses.length > 0) {
      return summary.top_weaknesses;
    }

    const weaknessScores = summary.weakness_scores || {};
    return Object.entries(weaknessScores)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([category, score]) => ({
        category,
        score,
        evidence: [],
        priority: score >= 0.75 ? 'high' : score >= 0.45 ? 'medium' : 'low',
      }));
  }

  private normalizeRecommendations(summary: AnalysisCompletedEvent['summary']) {
    if (Array.isArray(summary.recommendations) && summary.recommendations.length > 0) {
      return summary.recommendations;
    }

    const resources = Array.isArray(summary.learning_resources)
      ? summary.learning_resources
      : [];

    if (resources.length === 0) {
      return [];
    }

    return resources.slice(0, 5).map((resource) => ({
      weakness: resource.skill,
      action: `Review ${resource.title}`,
      learning_query: resource.url,
    }));
  }

  private inferSkillLevel(qualityScore: number | null | undefined): string {
    const score = typeof qualityScore === 'number' ? qualityScore : 0;
    if (score >= 8) return 'advanced';
    if (score >= 5.5) return 'intermediate';
    return 'beginner';
  }

  async ingestRepositoryAnalysis(event: AnalysisCompletedEvent) {
    const developerId = this.resolveDeveloperId(event);
    if (!developerId) {
      return;
    }

    const analyzedAt = event.analyzedAt ? new Date(event.analyzedAt) : new Date();
    const topWeaknesses = this.normalizeTopWeaknesses(event.summary);
    const recommendations = this.normalizeRecommendations(event.summary);
    const resolvedSkillLevel =
      event.summary.skill_level || this.inferSkillLevel(event.summary.quality_score);
    const topWeaknessMap = new Map(
      topWeaknesses.map((weakness) => [
        weakness.category,
        weakness,
      ]),
    );
    const recommendationMap = new Map(
      recommendations.map((recommendation) => [
        recommendation.weakness,
        recommendation,
      ]),
    );

    for (const [category, weaknessScore] of Object.entries(
      event.summary.weakness_scores || {},
    )) {
      const existing = await this.developerSkillModel.findOne({
        developerId,
        skillName: category,
      });

      const nextCommitCount = (existing?.commitCount || 0) + 1;
      const currentProficiency = typeof existing?.proficiency === 'number'
        ? existing.proficiency
        : 0;
      const currentWeightedScore = currentProficiency * (existing?.commitCount || 0);
      const incomingProficiency = Number(((1 - weaknessScore) * 10).toFixed(2));
      const nextWeightedScore = currentWeightedScore + incomingProficiency;
      const nextProficiency =
        nextCommitCount > 0
          ? Number((nextWeightedScore / nextCommitCount).toFixed(2))
          : incomingProficiency;
      const topWeakness = topWeaknessMap.get(category);
      const recommendation = recommendationMap.get(category);

      await this.updateDeveloperSkill(developerId, category, {
        proficiency: nextProficiency,
        commitCount: nextCommitCount,
        lastUsed: analyzedAt,
        statistics: {
          ...(existing?.statistics || {}),
          repositoryId: event.repositoryId,
          repoName: event.repoName,
          category,
          weaknessScore,
          qualityScore: event.summary.quality_score,
          skillLevel: resolvedSkillLevel,
          strengths: event.summary.strengths || [],
          topWeakness: topWeakness || null,
          recommendation: recommendation || null,
          ...(event.metadata || {}),
        },
      });
    }

    const existingOverall = await this.developerSkillModel.findOne({
      developerId,
      skillName: 'overall_code_quality',
    });
    const overallCount = (existingOverall?.commitCount || 0) + 1;
    const overallProficiency = Number((event.summary.quality_score || 0).toFixed(2));
    const overallWeightedScore =
      (existingOverall?.proficiency || 0) * (existingOverall?.commitCount || 0);

    await this.updateDeveloperSkill(developerId, 'overall_code_quality', {
      proficiency: Number(
        ((overallWeightedScore + overallProficiency) / overallCount).toFixed(2),
      ),
      commitCount: overallCount,
      lastUsed: analyzedAt,
      statistics: {
        ...(existingOverall?.statistics || {}),
        repositoryId: event.repositoryId,
        repoName: event.repoName,
        skillLevel: resolvedSkillLevel,
        strengths: event.summary.strengths || [],
        recommendations,
        topWeaknesses,
        v2Skills: event.summary.skills || [],
        v2LearningResources: event.summary.learning_resources || [],
        ...(event.metadata || {}),
      },
    });
  }
}
