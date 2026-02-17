import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SkillService } from './skill.service';

@Controller('skills')
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  @Get()
  findAll() {
    return this.skillService.findAll();
  }

  @Get('developer/:developerId')
  getDeveloperSkills(@Param('developerId') developerId: string) {
    return this.skillService.getDeveloperSkills(developerId);
  }

  @MessagePattern('skill.find.all')
  async handleFindAll(@Payload() message: any) {
    return this.skillService.findAll();
  }

  @MessagePattern('skill.developer.find')
  async handleGetDeveloperSkills(@Payload() message: any) {
    return this.skillService.getDeveloperSkills(message.developerId);
  }

  @MessagePattern('skill.updated')
  async handleSkillUpdated(@Payload() message: any) {
    // Process skill update event
    console.log('Skill updated:', message);
  }
}
