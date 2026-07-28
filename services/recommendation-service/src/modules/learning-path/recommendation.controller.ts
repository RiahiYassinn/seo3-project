import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { RecommendationService } from "./recommendation.service";
import { CourseCatalogService } from "./course-catalog.service";

@Controller("recommendations")
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly courseCatalogService: CourseCatalogService,
  ) {}

  @Post("catalog/ingest")
  async ingestCatalog(@Body() body: { path?: string }) {
    return this.courseCatalogService.ingestFromFile(body?.path);
  }

  @Get("developer/:developerId")
  async getRecommendations(@Param("developerId") developerId: string) {
    return this.recommendationService.getRecommendationsForDeveloper(
      developerId,
    );
  }

  @Get("contributor/:contributorLogin")
  async getContributorRecommendations(
    @Param("contributorLogin") contributorLogin: string,
  ) {
    return this.recommendationService.getRecommendationsForContributorLogin(
      contributorLogin,
    );
  }

  @Get("developer/:developerId/repository/:repositoryId")
  async getRepositoryRecommendations(
    @Param("developerId") developerId: string,
    @Param("repositoryId") repositoryId: string,
  ) {
    return this.recommendationService.getRecommendationsForRepository(
      developerId,
      repositoryId,
    );
  }

  @Get(
    "developer/:developerId/repository/:repositoryId/contributor/:contributorLogin",
  )
  async getContributorRecommendation(
    @Param("developerId") developerId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("contributorLogin") contributorLogin: string,
  ) {
    return this.recommendationService.getRecommendationForContributor(
      developerId,
      repositoryId,
      contributorLogin,
    );
  }

  @Post(
    "developer/:developerId/repository/:repositoryId/contributor/:contributorLogin/generate",
  )
  async generateContributorRecommendation(
    @Param("developerId") developerId: string,
    @Param("repositoryId") repositoryId: string,
    @Param("contributorLogin") contributorLogin: string,
  ) {
    return this.recommendationService.generateRecommendationForContributor(
      developerId,
      repositoryId,
      contributorLogin,
    );
  }

  @Get("mentors/available")
  async getAvailableMentors() {
    return this.recommendationService.getAvailableMentors();
  }

  @Get("developer/:developerId/mentor-requests")
  async getDeveloperMentorRequests(@Param("developerId") developerId: string) {
    return this.recommendationService.getMentorRequestsForDeveloper(
      developerId,
    );
  }

  @Get("mentor/:mentorId/requests")
  async getMentorRequests(@Param("mentorId") mentorId: string) {
    return this.recommendationService.getMentorRequestsForMentor(mentorId);
  }

  @Post(":recommendationId/request-mentor")
  async requestMentor(
    @Param("recommendationId") recommendationId: string,
    @Body() body: { mentorId: string; developerId?: string },
  ) {
    const developerId = body?.developerId;
    if (!developerId) {
      throw new BadRequestException("Developer id is required");
    }

    return this.recommendationService.requestMentor(
      recommendationId,
      developerId,
      body.mentorId,
    );
  }

  @Post("mentor-requests/:requestId/accept")
  async acceptMentorRequest(
    @Param("requestId") requestId: string,
    @Body() body: { mentorId?: string },
  ) {
    if (!body?.mentorId) {
      throw new BadRequestException("Mentor id is required");
    }

    return this.recommendationService.respondToMentorRequest(
      requestId,
      body.mentorId,
      "accepted",
    );
  }

  @Post("mentor-requests/:requestId/decline")
  async declineMentorRequest(
    @Param("requestId") requestId: string,
    @Body() body: { mentorId?: string },
  ) {
    if (!body?.mentorId) {
      throw new BadRequestException("Mentor id is required");
    }

    return this.recommendationService.respondToMentorRequest(
      requestId,
      body.mentorId,
      "declined",
    );
  }

  @Get("mentor/:mentorId/queue")
  async getMentorQueue(@Param("mentorId") mentorId: string) {
    return this.recommendationService.getMentorQueue(mentorId);
  }

  @Get(":recommendationId")
  async getRecommendationById(
    @Param("recommendationId") recommendationId: string,
    @Query("requesterId") requesterId: string,
    @Query("requesterRole") requesterRole: string,
    @Query("contributorLogin") contributorLogin?: string,
  ) {
    return this.recommendationService.getRecommendationById(
      recommendationId,
      requesterId,
      requesterRole,
      contributorLogin,
    );
  }

  @Post(":recommendationId/assign")
  async assignMentor(
    @Param("recommendationId") recommendationId: string,
    @Body() body: { mentorId: string },
  ) {
    return this.recommendationService.assignMentor(
      recommendationId,
      body.mentorId,
    );
  }

  @Post(":recommendationId/schedule-session")
  async scheduleMentorshipSession(
    @Param("recommendationId") recommendationId: string,
    @Body() body: { mentorId?: string; scheduledAt?: string; note?: string },
  ) {
    if (!body?.mentorId) {
      throw new BadRequestException("Mentor id is required");
    }

    if (!body?.scheduledAt) {
      throw new BadRequestException("Session date and time is required");
    }

    return this.recommendationService.scheduleMentorshipSession(
      recommendationId,
      body.mentorId,
      body.scheduledAt,
      body.note,
    );
  }
  @Post(":recommendationId/regenerate")
  async regenerateRecommendation(
    @Param("recommendationId") recommendationId: string,
  ) {
    return this.recommendationService.regenerateRecommendation(
      recommendationId,
    );
  }

  @Post(":recommendationId/acknowledge")
  async acknowledgeRecommendation(
    @Param("recommendationId") recommendationId: string,
    @Body() body: { developerId: string; contributorLogin?: string },
  ) {
    return this.recommendationService.acknowledgeRecommendation(
      recommendationId,
      body.developerId,
      body.contributorLogin,
    );
  }

  @Get(":recommendationId/quiz/:developerId")
  async getQuiz(
    @Param("recommendationId") recommendationId: string,
    @Param("developerId") developerId: string,
    @Query("contributorLogin") contributorLogin?: string,
  ) {
    return this.recommendationService.getQuiz(recommendationId, {
      developerId,
      contributorLogin,
    });
  }

  @Post(":recommendationId/quiz/generate")
  async generateQuiz(
    @Param("recommendationId") recommendationId: string,
    @Body()
    body: {
      developerId: string;
      contributorLogin?: string;
      regenerate?: boolean;
    },
  ) {
    return this.recommendationService.generateQuiz(
      recommendationId,
      { developerId: body.developerId, contributorLogin: body.contributorLogin },
      { regenerate: Boolean(body.regenerate) },
    );
  }

  @Post(":recommendationId/quiz/submit")
  async submitQuiz(
    @Param("recommendationId") recommendationId: string,
    @Body()
    body: {
      developerId: string;
      contributorLogin?: string;
      answers: Array<{ questionId: string; selectedIndex: number }>;
    },
  ) {
    return this.recommendationService.submitQuiz(
      recommendationId,
      { developerId: body.developerId, contributorLogin: body.contributorLogin },
      body.answers || [],
    );
  }
}
