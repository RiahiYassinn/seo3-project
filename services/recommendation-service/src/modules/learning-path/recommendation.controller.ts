import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get('developer/:developerId')
  async getRecommendations(@Param('developerId') developerId: string) {
    return this.recommendationService.getRecommendationsForDeveloper(developerId);
  }

  @Get('contributor/:contributorLogin')
  async getContributorRecommendations(
    @Param('contributorLogin') contributorLogin: string,
  ) {
    return this.recommendationService.getRecommendationsForContributorLogin(
      contributorLogin,
    );
  }

  @Get('developer/:developerId/repository/:repositoryId')
  async getRepositoryRecommendations(
    @Param('developerId') developerId: string,
    @Param('repositoryId') repositoryId: string,
  ) {
    return this.recommendationService.getRecommendationsForRepository(
      developerId,
      repositoryId,
    );
  }

  @Get('developer/:developerId/repository/:repositoryId/contributor/:contributorLogin')
  async getContributorRecommendation(
    @Param('developerId') developerId: string,
    @Param('repositoryId') repositoryId: string,
    @Param('contributorLogin') contributorLogin: string,
  ) {
    return this.recommendationService.getRecommendationForContributor(
      developerId,
      repositoryId,
      contributorLogin,
    );
  }

  @Get('mentor/:mentorId/queue')
  async getMentorQueue(@Param('mentorId') mentorId: string) {
    return this.recommendationService.getMentorQueue(mentorId);
  }

  @Post(':recommendationId/assign')
  async assignMentor(
    @Param('recommendationId') recommendationId: string,
    @Body() body: { mentorId: string },
  ) {
    return this.recommendationService.assignMentor(
      recommendationId,
      body.mentorId,
    );
  }

  @Post(':recommendationId/regenerate')
  async regenerateRecommendation(
    @Param('recommendationId') recommendationId: string,
  ) {
    return this.recommendationService.regenerateRecommendation(recommendationId);
  }

  @Post(':recommendationId/acknowledge')
  async acknowledgeRecommendation(
    @Param('recommendationId') recommendationId: string,
    @Body() body: { developerId: string },
  ) {
    return this.recommendationService.acknowledgeRecommendation(
      recommendationId,
      body.developerId,
    );
  }
}
