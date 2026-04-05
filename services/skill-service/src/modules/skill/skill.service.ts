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
    overallScore: number;
    skillLevel: string;
    cleanCodeScore: number;
    goodPracticesScore: number;
    maintainabilityScore: number;
    collaborationScore: number;
    strengths: string[];
    improvements: string[];
    commitCount: number;
    filesTouched: number;
  };
  detectedSkills: Array<{
    skillName: string;
    category: string;
    proficiency: number;
    commitCount: number;
    confidence: number;
    statistics?: Record<string, any>;
  }>;
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

    for (const skill of event.detectedSkills) {
      const existing = await this.developerSkillModel.findOne({
        developerId: event.developerId,
        skillName: skill.skillName,
      });

      const nextCommitCount = (existing?.commitCount || 0) + skill.commitCount;
      const currentWeightedScore =
        (existing?.proficiency || 0) * (existing?.commitCount || 0);
      const nextWeightedScore = currentWeightedScore + skill.proficiency * skill.commitCount;
      const nextProficiency =
        nextCommitCount > 0
          ? Number((nextWeightedScore / nextCommitCount).toFixed(2))
          : skill.proficiency;

      await this.updateDeveloperSkill(event.developerId, skill.skillName, {
        proficiency: nextProficiency,
        commitCount: nextCommitCount,
        lastUsed: analyzedAt,
        statistics: {
          ...(existing?.statistics || {}),
          ...(skill.statistics || {}),
          repositoryId: event.repositoryId,
          repoName: event.repoName,
          category: skill.category,
          confidence: skill.confidence,
          overallScore: event.summary.overallScore,
          skillLevel: event.summary.skillLevel,
          strengths: event.summary.strengths,
          improvements: event.summary.improvements,
          filesTouched: event.summary.filesTouched,
          ...(event.metadata || {}),
        },
      });
    }
  }
}
