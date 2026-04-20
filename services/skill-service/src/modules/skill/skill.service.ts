import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Skill, DeveloperSkill } from './schemas/skill.schema';

interface AnalysisCompletedEvent {
  repositoryId: string;
  developerId: string;
  repoName: string;
  analyzedAt?: string;
  summary: {
    weakness_scores: Record<string, number>;
    top_weaknesses: Array<{
      category: string;
      score: number;
      evidence: string[];
      priority: string;
    }>;
    strengths: string[];
    quality_score: number | null;
    skill_level: string;
    recommendations: Array<{
      weakness: string;
      action: string;
      learning_query: string;
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

  async ingestRepositoryAnalysis(event: AnalysisCompletedEvent) {
    const analyzedAt = event.analyzedAt ? new Date(event.analyzedAt) : new Date();
    const topWeaknessMap = new Map(
      (event.summary.top_weaknesses || []).map((weakness) => [
        weakness.category,
        weakness,
      ]),
    );
    const recommendationMap = new Map(
      (event.summary.recommendations || []).map((recommendation) => [
        recommendation.weakness,
        recommendation,
      ]),
    );

    for (const [category, weaknessScore] of Object.entries(
      event.summary.weakness_scores || {},
    )) {
      const existing = await this.developerSkillModel.findOne({
        developerId: event.developerId,
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

      await this.updateDeveloperSkill(event.developerId, category, {
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
          skillLevel: event.summary.skill_level,
          strengths: event.summary.strengths,
          topWeakness: topWeakness || null,
          recommendation: recommendation || null,
          ...(event.metadata || {}),
        },
      });
    }

    const existingOverall = await this.developerSkillModel.findOne({
      developerId: event.developerId,
      skillName: 'overall_code_quality',
    });
    const overallCount = (existingOverall?.commitCount || 0) + 1;
    const overallProficiency = Number((event.summary.quality_score || 0).toFixed(2));
    const overallWeightedScore =
      (existingOverall?.proficiency || 0) * (existingOverall?.commitCount || 0);

    await this.updateDeveloperSkill(event.developerId, 'overall_code_quality', {
      proficiency: Number(
        ((overallWeightedScore + overallProficiency) / overallCount).toFixed(2),
      ),
      commitCount: overallCount,
      lastUsed: analyzedAt,
      statistics: {
        ...(existingOverall?.statistics || {}),
        repositoryId: event.repositoryId,
        repoName: event.repoName,
        skillLevel: event.summary.skill_level,
        strengths: event.summary.strengths,
        recommendations: event.summary.recommendations,
        topWeaknesses: event.summary.top_weaknesses,
        ...(event.metadata || {}),
      },
    });
  }
}
