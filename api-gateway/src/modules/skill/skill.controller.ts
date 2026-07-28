import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SkillService } from './skill.service';

@ApiTags('skills')
@Controller('skills')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  @Get()
  @ApiOperation({ summary: 'Get all skills' })
  findAll() {
    return this.skillService.findAll();
  }

  @Get('developer/:developerId')
  @ApiOperation({ summary: 'Get developer skills' })
  getDeveloperSkills(@Param('developerId') developerId: string) {
    return this.skillService.getDeveloperSkills(developerId);
  }

  @Get('graph/:developerId')
  @ApiOperation({ summary: 'Get developer skill graph' })
  getSkillGraph(@Param('developerId') developerId: string) {
    return this.skillService.getSkillGraph(developerId);
  }

  @Get('learning-paths/:developerId')
  @ApiOperation({ summary: 'Get learning paths for developer' })
  getLearningPaths(@Param('developerId') developerId: string) {
    return this.skillService.getLearningPaths(developerId);
  }
}
