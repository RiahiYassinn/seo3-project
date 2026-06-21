import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  ConflictException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RecommendationService } from "./recommendation.service";
import { GithubService } from "../github/github.service";

import { IsString, IsNotEmpty, IsOptional } from "class-validator";

class RequestMentorDto {
  @IsString()
  @IsNotEmpty()
  mentorId: string;
}
class ScheduleMentorshipSessionDto {
  @IsString()
  @IsNotEmpty()
  scheduledAt: string;

  @IsString()
  @IsOptional()
  note?: string;
}

@ApiTags("recommendations")
@Controller("recommendations")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth()
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly githubService: GithubService,
  ) {}

  @Get("me")
  @ApiOperation({
    summary: "Get recommendations for current authenticated user",
  })
  async getMyRecommendations(@Req() req: any) {
    const normalizedRole = String(req?.user?.role || "")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");

    if (normalizedRole === "developer") {
      try {
        const integration = await this.githubService.getIntegration(
          req.user.id,
        );
        const contributorLogin = String(
          integration?.github_username || "",
        ).trim();
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

  @Get("repository/:repositoryId")
  @ApiOperation({
    summary: "Get recommendations for current developer in a repository",
  })
  getRepositoryRecommendations(
    @Req() req: any,
    @Param("repositoryId") repositoryId: string,
  ) {
    return this.recommendationService.getRepositoryRecommendations(
      req.user.id,
      repositoryId,
    );
  }

  @Get("repository/:repositoryId/contributor/:contributorLogin")
  @ApiOperation({
    summary:
      "Get recommendation for one contributor in current developer repository",
  })
  getContributorRecommendation(
    @Req() req: any,
    @Param("repositoryId") repositoryId: string,
    @Param("contributorLogin") contributorLogin: string,
  ) {
    return this.recommendationService.getContributorRecommendation(
      req.user.id,
      repositoryId,
      contributorLogin,
    );
  }

  @Post("repository/:repositoryId/contributor/:contributorLogin/generate")
  @ApiOperation({
    summary: "Generate recommendation manually for a contributor profile",
  })
  generateContributorRecommendation(
    @Req() req: any,
    @Param("repositoryId") repositoryId: string,
    @Param("contributorLogin") contributorLogin: string,
  ) {
    const normalizedRole = String(req?.user?.role || "")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");

    if (normalizedRole !== "admin") {
      throw new ForbiddenException(
        "Only admins can generate recommendations manually",
      );
    }

    return this.recommendationService.generateContributorRecommendation(
      req.user.id,
      repositoryId,
      contributorLogin,
    );
  }

  @Get("mentors/available")
  @ApiOperation({ summary: "Get available mentors for mentorship requests" })
  getAvailableMentors() {
    return this.recommendationService.getAvailableMentors();
  }
  @Get("my-mentor-requests")
  @ApiOperation({
    summary: "Get mentor requests created by the current developer",
  })
  getMyMentorRequests(@Req() req: any) {
    return this.recommendationService.getMyMentorRequests(req.user.id);
  }
  @Get("mentor-requests")
  @ApiOperation({
    summary: "Get pending mentor requests for the current mentor",
  })
  getMentorRequests(@Req() req: any) {
    return this.recommendationService.getMentorRequests(req.user.id);
  }
  @Post(":recommendationId/request-mentor")
  @ApiOperation({ summary: "Request a mentor for a mentorship recommendation" })
  requestMentor(
    @Req() req: any,
    @Param("recommendationId") recommendationId: string,
    @Body() body: RequestMentorDto,
  ) {
    const normalizedRole = String(req?.user?.role || "")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");

    if (normalizedRole !== "developer") {
      throw new ForbiddenException("Only developers can request a mentor");
    }

    return this.recommendationService.requestMentor(
      recommendationId,
      body.mentorId,
      req.user.id,
    );
  }

  @Post("mentor-requests/:requestId/accept")
  @ApiOperation({ summary: "Accept a mentor request" })
  acceptMentorRequest(@Req() req: any, @Param("requestId") requestId: string) {
    const normalizedRole = String(req?.user?.role || "")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");

    if (normalizedRole !== "tech_lead") {
      throw new ForbiddenException("Only mentors can accept mentor requests");
    }

    return this.recommendationService.acceptMentorRequest(
      requestId,
      req.user.id,
    );
  }

  @Post("mentor-requests/:requestId/decline")
  @ApiOperation({ summary: "Decline a mentor request" })
  declineMentorRequest(@Req() req: any, @Param("requestId") requestId: string) {
    const normalizedRole = String(req?.user?.role || "")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");

    if (normalizedRole !== "tech_lead") {
      throw new ForbiddenException("Only mentors can decline mentor requests");
    }

    return this.recommendationService.declineMentorRequest(
      requestId,
      req.user.id,
    );
  }

  @Get("mentor-queue")
  @ApiOperation({
    summary: "Get mentor recommendation queue for current tech lead",
  })
  getMentorQueue(@Req() req: any) {
    return this.recommendationService.getMentorQueue(req.user.id);
  }

  @Get(":recommendationId")
  @ApiOperation({ summary: "Get a single recommendation by id" })
  async getRecommendation(
    @Req() req: any,
    @Param("recommendationId") recommendationId: string,
  ) {
    const normalizedRole = String(req?.user?.role || "")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");
    let contributorLogin: string | undefined;

    if (normalizedRole === "developer") {
      try {
        const integration = await this.githubService.getIntegration(req.user.id);
        contributorLogin = String(integration?.github_username || "").trim() || undefined;
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

    return this.recommendationService.getRecommendationById(
      recommendationId,
      req.user.id,
      normalizedRole,
      contributorLogin,
    );
  }

  @Post(":recommendationId/assign-self")
  @ApiOperation({
    summary: "Assign current tech lead to a mentorship recommendation",
  })
  assignToSelf(
    @Req() req: any,
    @Param("recommendationId") recommendationId: string,
  ) {
    return this.recommendationService.assignMentor(
      recommendationId,
      req.user.id,
    );
  }

  @Post(":recommendationId/schedule-session")
  @ApiOperation({
    summary: "Schedule a mentorship session for an assigned recommendation",
  })
  scheduleMentorshipSession(
    @Req() req: any,
    @Param("recommendationId") recommendationId: string,
    @Body() body: ScheduleMentorshipSessionDto,
  ) {
    const normalizedRole = String(req?.user?.role || "")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");

    if (normalizedRole !== "tech_lead") {
      throw new ForbiddenException(
        "Only assigned mentors can schedule mentorship sessions",
      );
    }

    return this.recommendationService.scheduleMentorshipSession(
      recommendationId,
      req.user.id,
      body.scheduledAt,
      body.note,
    );
  }
  @Post(":recommendationId/acknowledge")
  @ApiOperation({
    summary: "Acknowledge recommendation completion for current developer",
  })
  acknowledgeRecommendation(
    @Req() req: any,
    @Param("recommendationId") recommendationId: string,
  ) {
    return this.recommendationService.acknowledgeRecommendation(
      recommendationId,
      req.user.id,
    );
  }

  @Post(":recommendationId/assign")
  @ApiOperation({
    summary: "Assign a specific mentor to recommendation (admin/ops)",
  })
  assignMentor(
    @Param("recommendationId") recommendationId: string,
    @Body() body: { mentor_id: string },
  ) {
    return this.recommendationService.assignMentor(
      recommendationId,
      body.mentor_id,
    );
  }

  @Post(":recommendationId/regenerate")
  @ApiOperation({
    summary: "Regenerate recommendation using latest analysis data",
  })
  regenerateRecommendation(
    @Req() req: any,
    @Param("recommendationId") recommendationId: string,
  ) {
    const normalizedRole = String(req?.user?.role || "")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");

    if (normalizedRole !== "admin") {
      throw new ForbiddenException(
        "Only admins can regenerate recommendations",
      );
    }

    return this.recommendationService.regenerateRecommendation(
      recommendationId,
    );
  }
}

