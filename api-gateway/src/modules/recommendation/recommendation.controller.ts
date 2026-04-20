import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RecommendationService } from './recommendation.service';

@ApiTags('recommendations')
@Controller('recommendations')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get all recommendations for current developer' })
  getMyRecommendations(@Req() req: any) {
    return this.recommendationService.getMyRecommendations(req.user.id);
  }

  @Get('repository/:repositoryId')
  @ApiOperation({ summary: 'Get recommendations for current developer in a repository' })
  getRepositoryRecommendations(
    @Req() req: any,
    @Param('repositoryId') repositoryId: string,
  ) {
    return this.recommendationService.getRepositoryRecommendations(
      req.user.id,
      repositoryId,
    );
  }

  @Get('repository/:repositoryId/contributor/:contributorLogin')
  @ApiOperation({ summary: 'Get recommendation for one contributor in current developer repository' })
  getContributorRecommendation(
    @Req() req: any,
    @Param('repositoryId') repositoryId: string,
    @Param('contributorLogin') contributorLogin: string,
  ) {
    return this.recommendationService.getContributorRecommendation(
      req.user.id,
      repositoryId,
      contributorLogin,
    );
  }

  @Get('mentor-queue')
  @ApiOperation({ summary: 'Get mentor recommendation queue for current tech lead' })
  getMentorQueue(@Req() req: any) {
    return this.recommendationService.getMentorQueue(req.user.id);
  }

  @Post(':recommendationId/assign-self')
  @ApiOperation({ summary: 'Assign current tech lead to a mentorship recommendation' })
  assignToSelf(@Req() req: any, @Param('recommendationId') recommendationId: string) {
    return this.recommendationService.assignMentor(recommendationId, req.user.id);
  }

  @Post(':recommendationId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge recommendation completion for current developer' })
  acknowledgeRecommendation(
    @Req() req: any,
    @Param('recommendationId') recommendationId: string,
  ) {
    return this.recommendationService.acknowledgeRecommendation(
      recommendationId,
      req.user.id,
    );
  }

  @Post(':recommendationId/assign')
  @ApiOperation({ summary: 'Assign a specific mentor to recommendation (admin/ops)' })
  assignMentor(
    @Param('recommendationId') recommendationId: string,
    @Body() body: { mentor_id: string },
  ) {
    return this.recommendationService.assignMentor(
      recommendationId,
      body.mentor_id,
    );
  }
}
