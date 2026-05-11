import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RecommendationService } from './recommendation.service';
import { GithubService } from '../github/github.service';

@ApiTags('recommendations')
@Controller('recommendations')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly githubService: GithubService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get recommendations for current authenticated user' })
  async getMyRecommendations(@Req() req: any) {
    const normalizedRole = String(req?.user?.role || '')
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');

    if (normalizedRole === 'developer') {
      try {
        const integration = await this.githubService.getIntegration(req.user.id);
        const contributorLogin = String(integration?.github_username || '').trim();
        if (!contributorLogin) {
          return [];
        }

        return this.recommendationService.getRecommendationsForContributorLogin(
          contributorLogin,
        );
      } catch (error) {
        if (error instanceof NotFoundException) {
          return [];
        }
        throw error;
      }
    }

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

  @Post('repository/:repositoryId/contributor/:contributorLogin/generate')
  @ApiOperation({ summary: 'Generate recommendation manually for a contributor profile' })
  generateContributorRecommendation(
    @Req() req: any,
    @Param('repositoryId') repositoryId: string,
    @Param('contributorLogin') contributorLogin: string,
  ) {
    const normalizedRole = String(req?.user?.role || '')
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');

    if (normalizedRole !== 'admin') {
      throw new ForbiddenException('Only admins can generate recommendations manually');
    }

    return this.recommendationService.generateContributorRecommendation(
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

  @Post(':recommendationId/regenerate')
  @ApiOperation({ summary: 'Regenerate recommendation using latest analysis data' })
  regenerateRecommendation(
    @Req() req: any,
    @Param('recommendationId') recommendationId: string,
  ) {
    const normalizedRole = String(req?.user?.role || '')
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');

    if (normalizedRole !== 'admin') {
      throw new ForbiddenException('Only admins can regenerate recommendations');
    }

    return this.recommendationService.regenerateRecommendation(recommendationId);
  }
}
