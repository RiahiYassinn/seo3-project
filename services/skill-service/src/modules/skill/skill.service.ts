import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Skill, DeveloperSkill } from './schemas/skill.schema';

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
}
