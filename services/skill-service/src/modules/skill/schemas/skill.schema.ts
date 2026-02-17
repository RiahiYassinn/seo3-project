import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Skill extends Document {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  category: string;

  @Prop()
  description: string;

  @Prop([String])
  relatedSkills: string[];

  @Prop({ type: Object })
  metadata: Record<string, any>;
}

export const SkillSchema = SchemaFactory.createForClass(Skill);

@Schema({ timestamps: true })
export class DeveloperSkill extends Document {
  @Prop({ required: true })
  developerId: string;

  @Prop({ required: true })
  skillName: string;

  @Prop({ default: 0 })
  proficiency: number;

  @Prop({ default: 0 })
  commitCount: number;

  @Prop()
  lastUsed: Date;

  @Prop({ type: Object })
  statistics: Record<string, any>;
}

export const DeveloperSkillSchema = SchemaFactory.createForClass(DeveloperSkill);
