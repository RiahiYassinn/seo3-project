import { Module } from '@nestjs/common';
import { SkillController } from './skill.controller';

@Module({
  controllers: [SkillController],
})
export class SkillModule {}
