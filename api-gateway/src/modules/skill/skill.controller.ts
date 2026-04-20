import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('skills')
@Controller('skills')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class SkillController {
  @Get()
  @ApiOperation({ summary: 'Get all skills' })
  findAll() {
    return { message: 'Get all skills - proxied to Skill Service' };
  }

  @Get('developer/:developerId')
  @ApiOperation({ summary: 'Get developer skills' })
  getDeveloperSkills(@Param('developerId') developerId: string) {
    return { message: `Get skills for developer ${developerId} - proxied to Skill Service` };
  }

  @Get('graph/:developerId')
  @ApiOperation({ summary: 'Get developer skill graph' })
  getSkillGraph(@Param('developerId') developerId: string) {
    return { message: `Get skill graph for developer ${developerId} - proxied to Skill Service` };
  }

  @Get('learning-paths/:developerId')
  @ApiOperation({ summary: 'Get learning paths for developer' })
  getLearningPaths(@Param('developerId') developerId: string) {
    return { message: `Get learning paths for developer ${developerId} - proxied to Skill Service` };
  }
}
