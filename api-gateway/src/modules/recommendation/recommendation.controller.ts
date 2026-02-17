import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('recommendations')
@Controller('recommendations')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class RecommendationController {
  @Get('learning-paths/:developerId')
  @ApiOperation({ summary: 'Get personalized learning paths' })
  getLearningPaths(@Param('developerId') developerId: string) {
    return { message: `Get learning paths for developer ${developerId} - proxied to Recommendation Service` };
  }

  @Get('mentors/:developerId')
  @ApiOperation({ summary: 'Get mentor recommendations' })
  getMentorRecommendations(@Param('developerId') developerId: string) {
    return { message: `Get mentor recommendations for developer ${developerId} - proxied to Recommendation Service` };
  }

  @Get('content/:developerId')
  @ApiOperation({ summary: 'Get content recommendations' })
  getContentRecommendations(@Param('developerId') developerId: string) {
    return { message: `Get content recommendations for developer ${developerId} - proxied to Recommendation Service` };
  }

  @Get('skill-gaps/:developerId')
  @ApiOperation({ summary: 'Get skill gap analysis' })
  getSkillGaps(@Param('developerId') developerId: string) {
    return { message: `Get skill gaps for developer ${developerId} - proxied to Recommendation Service` };
  }
}
