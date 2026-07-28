import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ClientKafka, ClientProxy } from "@nestjs/microservices";
import { InjectRepository } from "@nestjs/typeorm";
import { firstValueFrom } from "rxjs";
import { Between, FindOptionsWhere, In, IsNull, Repository } from "typeorm";
import {
  MentorshipSessionMode,
  RecommendationCase,
  RecommendationType,
} from "./entities/recommendation-case.entity";
import { MentorRequest } from "./entities/mentor-request.entity";
import {
  AnalysisCompletedEvent,
  AnalysisSummary,
  RecommendationGenerationResult,
  RecommendationHistorySnapshot,
} from "./recommendation-rag.types";
import { RagLearningPathService } from "./rag-learning-path.service";
import { TeamsMeetingService } from "./teams-meeting.service";

interface MentorCandidate {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_mentor: boolean;
  is_active: boolean;
  last_login_at?: string | null;
}

@Injectable()
export class RecommendationService implements OnModuleInit {
  private readonly logger = new Logger(RecommendationService.name);
  private readonly notificationServiceBaseUrl =
    process.env.NOTIFICATION_SERVICE_HTTP_URL ||
    process.env.NOTIFICATION_SERVICE_URL?.replace(/^tcp:/, "http:") ||
    "http://localhost:3005";

  constructor(
    @InjectRepository(RecommendationCase)
    private readonly recommendationRepo: Repository<RecommendationCase>,
    @InjectRepository(MentorRequest)
    private readonly mentorRequestRepo: Repository<MentorRequest>,
    @Inject("DEVELOPER_SERVICE")
    private readonly developerService: ClientProxy,
    @Inject("RECOMMENDATION_EVENTS_CLIENT")
    private readonly eventClient: ClientKafka,
    private readonly ragLearningPathService: RagLearningPathService,
    private readonly teamsMeetingService: TeamsMeetingService,
  ) {}

  async onModuleInit() {
    await this.developerService.connect();
    await this.eventClient.connect();
  }

  async processAnalysisCompleted(payload: AnalysisCompletedEvent) {
    const targetDeveloperId = this.resolveTargetDeveloperId(payload);
    if (!targetDeveloperId || !payload.repositoryId) {
      return null;
    }

    const summary = (payload.summary || {}) as AnalysisSummary;
    const contributorLogin = this.resolveContributorLogin(
      payload,
      targetDeveloperId,
    );
    const generated = await this.ragLearningPathService.generateRecommendation(
      payload,
      summary,
    );
    const recommendationType = this.determineRecommendationType(
      summary,
      generated,
    );
    const history = await this.getRecommendationHistory(
      targetDeveloperId,
      contributorLogin,
      payload.repositoryId,
    );
    const existing = await this.findActiveRecommendation(
      targetDeveloperId,
      payload.repositoryId,
      contributorLogin,
      recommendationType,
    );

    const saved = await this.saveRecommendation({
      existing,
      targetDeveloperId,
      contributorLogin,
      repositoryId: payload.repositoryId,
      repoName: payload.repoName || "Repository",
      summary,
      history,
      generated,
      recommendationType,
      analyzedAt: payload.analyzedAt,
    });

    await this.emitNotificationEvent(saved, generated);
    return this.mapCase(saved);
  }

  async generateRecommendationForContributor(
    developerId: string,
    repositoryId: string,
    contributorLogin: string,
  ) {
    const normalizedLogin = this.normalizeContributorLogin(contributorLogin);
    if (!developerId || !repositoryId || !normalizedLogin) {
      throw new BadRequestException(
        "Developer, repository, and contributor are required",
      );
    }

    const repository = await firstValueFrom(
      this.developerService.send("github_get_repository", {
        userId: developerId,
        repositoryId,
      }),
    );

    if (!repository) {
      throw new BadRequestException("Repository not found");
    }

    const contributorProfiles =
      repository?.analysis_metadata?.contributorProfiles || {};
    const profile = contributorProfiles[normalizedLogin] || null;
    const latestSummary =
      profile?.analysisSummary ||
      profile?.analysis_summary ||
      repository?.analysis_summary ||
      null;

    if (!latestSummary || typeof latestSummary !== "object") {
      throw new BadRequestException(
        "No analysis summary found for this contributor profile",
      );
    }

    const payload: AnalysisCompletedEvent = {
      repositoryId,
      repoName:
        repository?.repo_name ||
        repository?.repoName ||
        profile?.repositoryName ||
        "Repository",
      developerId,
      requestedByUserId: developerId,
      githubUsername: normalizedLogin,
      analyzedAt: new Date().toISOString(),
      summary: latestSummary as AnalysisSummary,
    };

    const generated = await this.ragLearningPathService.generateRecommendation(
      payload,
      latestSummary as AnalysisSummary,
    );
    const recommendationType = this.determineRecommendationType(
      latestSummary as AnalysisSummary,
      generated,
    );
    const history = await this.getRecommendationHistory(
      developerId,
      normalizedLogin,
      repositoryId,
    );
    const existing = await this.findActiveRecommendation(
      developerId,
      repositoryId,
      normalizedLogin,
      recommendationType,
    );

    const saved = await this.saveRecommendation({
      existing,
      targetDeveloperId: developerId,
      contributorLogin: normalizedLogin,
      repositoryId,
      repoName: payload.repoName || "Repository",
      summary: latestSummary as AnalysisSummary,
      history,
      generated,
      recommendationType,
      analyzedAt: payload.analyzedAt,
    });

    await this.emitNotificationEvent(saved, generated);
    return this.mapCase(saved);
  }

  async regenerateRecommendation(recommendationId: string) {
    const recommendation = await this.recommendationRepo.findOne({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new BadRequestException("Recommendation not found");
    }

    const latestSummary = await this.fetchLatestAnalysisSummary(
      recommendation.targetDeveloperId,
      recommendation.repositoryId,
      recommendation.contributorLogin,
      recommendation.analysisSummary as AnalysisSummary | null,
    );
    const history = await this.getRecommendationHistory(
      recommendation.targetDeveloperId,
      recommendation.contributorLogin,
      recommendation.repositoryId,
    );
    const payload: AnalysisCompletedEvent = {
      repositoryId: recommendation.repositoryId,
      repoName: recommendation.contextSnapshot?.repoName || "Repository",
      developerId: recommendation.targetDeveloperId,
      requestedByUserId: recommendation.targetDeveloperId,
      githubUsername: recommendation.contributorLogin,
      analyzedAt: new Date().toISOString(),
      summary: latestSummary,
      detectedGaps: Array.isArray(recommendation.contextSnapshot?.detectedGaps)
        ? recommendation.contextSnapshot?.detectedGaps.map(
            (item: any) => item.label || item,
          )
        : undefined,
    };

    const generated = await this.ragLearningPathService.generateRecommendation(
      payload,
      latestSummary,
    );
    const recommendationType = this.determineRecommendationType(
      latestSummary,
      generated,
    );

    const saved = await this.saveRecommendation({
      existing: recommendation,
      targetDeveloperId: recommendation.targetDeveloperId,
      contributorLogin: recommendation.contributorLogin,
      repositoryId: recommendation.repositoryId,
      repoName: recommendation.contextSnapshot?.repoName || "Repository",
      summary: latestSummary,
      history: history.filter((item) => item.id !== recommendation.id),
      generated,
      recommendationType,
      analyzedAt: payload.analyzedAt,
    });

    await this.emitNotificationEvent(saved, generated, true);
    return this.mapCase(saved);
  }

  async getRecommendationsForDeveloper(developerId: string) {
    const cases = await this.recommendationRepo.find({
      where: { targetDeveloperId: developerId },
      order: { priorityScore: "DESC", createdAt: "DESC" },
    });

    return cases.map((item) => this.mapCase(item));
  }

  async getRecommendationsForContributorLogin(contributorLogin: string) {
    const normalizedLogin = this.normalizeContributorLogin(contributorLogin);
    if (!normalizedLogin) {
      return [];
    }

    const cases = await this.recommendationRepo.find({
      where: { contributorLogin: normalizedLogin },
      order: { priorityScore: "DESC", createdAt: "DESC" },
    });

    return cases.map((item) => this.mapCase(item));
  }

  async getRecommendationsForRepository(
    developerId: string,
    repositoryId: string,
  ) {
    const cases = await this.recommendationRepo.find({
      where: { targetDeveloperId: developerId, repositoryId },
      order: { priorityScore: "DESC", createdAt: "DESC" },
    });

    return cases.map((item) => this.mapCase(item));
  }

  async getRecommendationForContributor(
    developerId: string,
    repositoryId: string,
    contributorLogin: string,
  ) {
    const record = await this.recommendationRepo.findOne({
      where: {
        targetDeveloperId: developerId,
        repositoryId,
        contributorLogin: this.normalizeContributorLogin(contributorLogin),
      },
      order: { updatedAt: "DESC" },
    });

    return record ? this.mapCase(record) : null;
  }

  async getRecommendationById(
    recommendationId: string,
    requesterId: string,
    requesterRole: string,
    contributorLogin?: string,
  ) {
    const recommendation = await this.recommendationRepo.findOne({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new NotFoundException("Recommendation not found");
    }

    const normalizedRole = String(requesterRole || "")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");

    if (normalizedRole === "admin") {
      return this.mapCase(recommendation);
    }

    if (normalizedRole === "tech_lead") {
      this.assertTechLeadCanViewRecommendation(recommendation, requesterId);
      return this.mapCase(recommendation);
    }

    if (normalizedRole === "developer") {
      this.assertDeveloperCanViewRecommendation(
        recommendation,
        requesterId,
        contributorLogin,
      );
      return this.mapCase(recommendation);
    }

    throw new ForbiddenException("You do not have access to this recommendation");
  }

  async getMentorQueue(mentorId: string) {
    const pendingRequests = await this.mentorRequestRepo.find({
      where: { status: "pending" },
      order: { createdAt: "DESC" },
    });

    const blockedRecommendationIds = new Set(
      pendingRequests.map((request) => request.recommendationId),
    );

    const queue = await this.recommendationRepo.find({
      where: [
        {
          recommendationType: "mentorship",
          status: "open",
          mentorId: IsNull(),
        },
        {
          recommendationType: "mentorship",
          mentorId,
          status: In(["open", "assigned"]),
        },
      ],
      order: { priorityScore: "DESC", createdAt: "DESC" },
    });

    return queue
      .filter(
        (item) =>
          item.mentorId === mentorId || !blockedRecommendationIds.has(item.id),
      )
      .map((item) => this.mapCase(item));
  }

  async assignMentor(recommendationId: string, mentorId: string) {
    const recommendation = await this.recommendationRepo.findOne({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      return null;
    }

    const mentors = await this.fetchMentorCandidates();
    const mentor = mentors.find((candidate) => candidate.id === mentorId);

    if (!mentor) {
      throw new BadRequestException(
        "Mentor must be an active tech lead with mentor flag enabled",
      );
    }

    recommendation.mentorId = mentorId;
    recommendation.mentorSnapshot = {
      id: mentor.id,
      name: `${mentor.first_name || ""} ${mentor.last_name || ""}`.trim(),
      username: mentor.username || null,
      email: mentor.email,
      role: mentor.role,
    };
    recommendation.status = "assigned";
    recommendation.recommendationType = "mentorship";

    const saved = await this.recommendationRepo.save(recommendation);
    return this.mapCase(saved);
  }

  async scheduleMentorshipSession(
    recommendationId: string,
    mentorId: string,
    scheduledAt: string,
    note?: string | null,
    mode: MentorshipSessionMode = "remote",
    location?: string | null,
  ) {
    const recommendation = await this.recommendationRepo.findOne({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new BadRequestException("Recommendation not found");
    }

    if (recommendation.recommendationType !== "mentorship") {
      throw new BadRequestException(
        "Only mentorship recommendations can have scheduled sessions",
      );
    }

    if (recommendation.mentorId !== mentorId) {
      throw new BadRequestException(
        "Only the assigned mentor can schedule this session",
      );
    }

    const parsedScheduledAt = new Date(scheduledAt);
    if (Number.isNaN(parsedScheduledAt.getTime())) {
      throw new BadRequestException("A valid session date and time is required");
    }

    const normalizedMode: MentorshipSessionMode =
      mode === "onsite" ? "onsite" : "remote";
    const normalizedLocation = location?.trim() || null;

    if (normalizedMode === "onsite" && !normalizedLocation) {
      throw new BadRequestException(
        "On-site sessions need a meeting location",
      );
    }

    recommendation.mentorshipSessionScheduledAt = parsedScheduledAt;
    recommendation.mentorshipSessionNote = note?.trim() || null;
    recommendation.mentorshipSessionMode = normalizedMode;
    recommendation.mentorshipSessionLocation =
      normalizedMode === "onsite" ? normalizedLocation : null;
    // A rescheduled session must re-arm the reminder.
    recommendation.mentorshipSessionReminderSentAt = null;

    if (normalizedMode === "remote") {
      const meeting = await this.teamsMeetingService.createMeeting({
        subject: `Mentoring: ${recommendation.title}`,
        startDateTime: parsedScheduledAt.toISOString(),
        endDateTime: new Date(
          parsedScheduledAt.getTime() + 60 * 60 * 1000,
        ).toISOString(),
      });

      recommendation.mentorshipSessionJoinUrl = meeting?.joinUrl || null;
    } else {
      recommendation.mentorshipSessionJoinUrl = null;
    }

    const saved = await this.recommendationRepo.save(recommendation);

    await this.emitMentorshipSessionScheduledNotification(saved);
    await this.sendMentorshipSessionEmails(saved, "invite");

    return this.mapCase(saved);
  }

  /* ------------------------ Session emails & reminders ------------------------ */

  private async lookupUser(userId?: string | null) {
    if (!userId) return null;

    try {
      return await firstValueFrom(
        this.developerService.send("find_user_by_id", { id: userId }),
      );
    } catch (error) {
      this.logger.warn(
        `Could not load user ${userId} for session email: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }
  }

  private displayName(user: any, fallback: string) {
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
    return name || user?.username || user?.email || fallback;
  }

  /**
   * Emails both sides of a session. Failures are logged, never thrown — a mail
   * outage must not roll back a scheduled session.
   */
  private async sendMentorshipSessionEmails(
    recommendation: RecommendationCase,
    kind: "invite" | "reminder",
    minutesUntil = 15,
  ) {
    if (!recommendation.mentorshipSessionScheduledAt) {
      return;
    }

    const [developer, mentor] = await Promise.all([
      this.lookupUser(recommendation.targetDeveloperId),
      this.lookupUser(recommendation.mentorId),
    ]);

    const mentorName =
      recommendation.mentorSnapshot?.name ||
      this.displayName(mentor, "Your mentor");

    const base = {
      kind,
      topic: recommendation.title,
      scheduledAt: new Date(
        recommendation.mentorshipSessionScheduledAt,
      ).toISOString(),
      timeZone: process.env.SESSION_TIME_ZONE || "UTC",
      mode: recommendation.mentorshipSessionMode || "remote",
      location: recommendation.mentorshipSessionLocation,
      joinUrl: recommendation.mentorshipSessionJoinUrl,
      note: recommendation.mentorshipSessionNote,
      mentorName,
      minutesUntil,
    };

    const recipients: Array<{ to: string; recipientName: string }> = [];

    // Invitations go to the developer; reminders go to both sides.
    const developerEmail =
      developer?.email || recommendation.mentorSnapshot?.developerEmail;
    if (developerEmail) {
      recipients.push({
        to: developerEmail,
        recipientName: this.displayName(developer, recommendation.contributorLogin),
      });
    }

    if (kind === "reminder") {
      const mentorEmail =
        mentor?.email || recommendation.mentorSnapshot?.email || null;
      if (mentorEmail) {
        recipients.push({ to: mentorEmail, recipientName: mentorName });
      }
    }

    if (!recipients.length) {
      this.logger.warn(
        `No email recipients resolved for session ${recommendation.id} (${kind})`,
      );
      return;
    }

    for (const recipient of recipients) {
      try {
        await firstValueFrom(
          this.developerService.send("send_mentorship_session_email", {
            ...base,
            ...recipient,
          }),
        );
      } catch (error) {
        this.logger.error(
          `Failed to send ${kind} email to ${recipient.to}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
  }

  /**
   * Sends the pre-session reminder for anything starting inside the window.
   * `mentorshipSessionReminderSentAt` makes it idempotent across ticks.
   */
  async dispatchDueSessionReminders(leadMinutes = 15) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + leadMinutes * 60 * 1000);

    const due = await this.recommendationRepo.find({
      where: {
        mentorshipSessionReminderSentAt: IsNull(),
        mentorshipSessionScheduledAt: Between(now, windowEnd),
      },
    });

    if (!due.length) {
      return { sent: 0 };
    }

    for (const recommendation of due) {
      const minutesUntil = Math.max(
        1,
        Math.round(
          (new Date(recommendation.mentorshipSessionScheduledAt!).getTime() -
            Date.now()) /
            60000,
        ),
      );

      await this.sendMentorshipSessionEmails(
        recommendation,
        "reminder",
        minutesUntil,
      );

      recommendation.mentorshipSessionReminderSentAt = new Date();
      await this.recommendationRepo.save(recommendation);
    }

    this.logger.log(`Sent reminders for ${due.length} upcoming session(s)`);
    return { sent: due.length };
  }
  async acknowledgeRecommendation(
    recommendationId: string,
    developerId: string,
    contributorLogin?: string,
  ) {
    const recommendation = await this.findOwnRecommendation(recommendationId, {
      developerId,
      contributorLogin,
    });

    recommendation.status = "completed";
    recommendation.outcomeStatus = "resolved";
    recommendation.outcomeMetrics = {
      ...(recommendation.outcomeMetrics || {}),
      completedAt: new Date().toISOString(),
    };

    const saved = await this.recommendationRepo.save(recommendation);
    return this.mapCase(saved);
  }

  /* ----------------------------- Validation quiz ----------------------------- */

  private static readonly QUIZ_PASS_PERCENT = 70;
  private static readonly QUIZ_QUESTION_COUNT = 5;

  /**
   * A recommendation belongs to the viewer either because it was generated for
   * their user id, or because it targets their linked GitHub contributor login
   * — admin-generated cases carry the admin's id in targetDeveloperId, so the
   * login is what actually ties them to the developer.
   */
  private async findOwnRecommendation(
    recommendationId: string,
    viewer: { developerId?: string; contributorLogin?: string },
  ) {
    const where: FindOptionsWhere<RecommendationCase>[] = [];

    if (viewer.developerId) {
      where.push({
        id: recommendationId,
        targetDeveloperId: viewer.developerId,
      });
    }

    const normalizedLogin = this.normalizeContributorLogin(
      viewer.contributorLogin || "",
    );
    if (normalizedLogin) {
      where.push({ id: recommendationId, contributorLogin: normalizedLogin });
    }

    if (!where.length) {
      throw new BadRequestException("Recommendation not found");
    }

    const recommendation = await this.recommendationRepo.findOne({ where });

    if (!recommendation) {
      throw new BadRequestException("Recommendation not found");
    }

    return recommendation;
  }

  /** Client-facing quiz shape. Answer keys stay on the server until graded. */
  private toQuizDto(recommendation: RecommendationCase) {
    const quiz = recommendation.quiz;
    const attempts = Array.isArray(recommendation.quizAttempts)
      ? recommendation.quizAttempts
      : [];
    const lastAttempt = attempts[attempts.length - 1] || null;

    return {
      recommendation_id: recommendation.id,
      status: recommendation.status,
      pass_percent: RecommendationService.QUIZ_PASS_PERCENT,
      passed: Boolean(recommendation.quizPassedAt),
      passed_at: recommendation.quizPassedAt
        ? new Date(recommendation.quizPassedAt).toISOString()
        : null,
      attempt_count: attempts.length,
      last_attempt: lastAttempt
        ? {
            attempted_at: lastAttempt.attemptedAt,
            score_percent: lastAttempt.scorePercent,
            correct_count: lastAttempt.correctCount,
            total: lastAttempt.total,
            passed: lastAttempt.passed,
          }
        : null,
      quiz: quiz
        ? {
            generated_at: quiz.generatedAt,
            provider: quiz.provider,
            model: quiz.model,
            question_count: (quiz.questions || []).length,
            questions: (quiz.questions || []).map(
              (question: any, index: number) => ({
                id: question.id || `q${index + 1}`,
                prompt: question.prompt,
                options: question.options,
                gap_key: question.gapKey,
                skill: question.skill || null,
              }),
            ),
          }
        : null,
    };
  }

  async getQuiz(
    recommendationId: string,
    viewer: { developerId?: string; contributorLogin?: string },
  ) {
    const recommendation = await this.findOwnRecommendation(
      recommendationId,
      viewer,
    );

    return this.toQuizDto(recommendation);
  }

  async generateQuiz(
    recommendationId: string,
    viewer: { developerId?: string; contributorLogin?: string },
    options: { regenerate?: boolean } = {},
  ) {
    const recommendation = await this.findOwnRecommendation(
      recommendationId,
      viewer,
    );

    if (recommendation.quiz && !options.regenerate) {
      return this.toQuizDto(recommendation);
    }

    const context = (recommendation.contextSnapshot || {}) as Record<string, any>;
    const detectedGaps = Array.isArray(context.detectedGaps)
      ? context.detectedGaps.map((gap: any) => ({
          key: String(gap?.key || "general"),
          label: String(gap?.label || "Unlabelled gap"),
          severity: String(gap?.severity || "medium"),
          evidence: Array.isArray(gap?.evidence) ? gap.evidence : [],
        }))
      : [];

    const learningSteps = Array.isArray(recommendation.learningPath?.steps)
      ? (recommendation.learningPath?.steps as any[])
      : [];
    const docsChecklist = Array.isArray(recommendation.docsReview?.checklist)
      ? (recommendation.docsReview?.checklist as any[])
      : [];

    const steps = learningSteps.length
      ? learningSteps.map((step: any) => ({
          title: String(step?.title || step?.skill || "Step"),
          goal: String(step?.goal || ""),
          whyItMatters: step?.why_it_matters
            ? String(step.why_it_matters)
            : undefined,
          practiceTask: step?.practice_task
            ? String(step.practice_task)
            : undefined,
          successSignal: step?.success_signal
            ? String(step.success_signal)
            : undefined,
          gapKeys: Array.isArray(step?.gap_keys) ? step.gap_keys : [],
          skill: step?.skill ? String(step.skill) : undefined,
        }))
      : docsChecklist.map((item: any) => ({
          title: String(item?.title || "Docs item"),
          goal: String(item?.note || ""),
          successSignal: item?.success_criteria
            ? String(item.success_criteria)
            : undefined,
          skill: item?.skill ? String(item.skill) : undefined,
          gapKeys: [],
        }));

    if (!detectedGaps.length && !steps.length) {
      throw new BadRequestException(
        "This recommendation has no gaps or steps to build a quiz from",
      );
    }

    const generated = await this.ragLearningPathService.generateQuiz({
      developerLabel: recommendation.contributorLogin,
      repoName: String(context.repoName || "the repository"),
      dominantLanguage: context.dominantLanguage
        ? String(context.dominantLanguage)
        : null,
      detectedGaps,
      steps,
      questionCount: RecommendationService.QUIZ_QUESTION_COUNT,
    });

    if (!generated.questions.length) {
      throw new BadRequestException("Could not build a quiz for this recommendation");
    }

    recommendation.quiz = {
      generatedAt: new Date().toISOString(),
      provider: generated.provider,
      model: generated.model,
      questions: generated.questions.map((question, index) => ({
        id: `q${index + 1}`,
        ...question,
      })),
    };

    // A regenerated quiz starts a fresh record; old attempts scored other questions.
    if (options.regenerate) {
      recommendation.quizAttempts = [];
      recommendation.quizPassedAt = null;
    }

    const saved = await this.recommendationRepo.save(recommendation);
    return this.toQuizDto(saved);
  }

  async submitQuiz(
    recommendationId: string,
    viewer: { developerId?: string; contributorLogin?: string },
    answers: Array<{ questionId: string; selectedIndex: number }>,
  ) {
    const recommendation = await this.findOwnRecommendation(
      recommendationId,
      viewer,
    );

    const questions = Array.isArray(recommendation.quiz?.questions)
      ? (recommendation.quiz?.questions as any[])
      : [];

    if (!questions.length) {
      throw new BadRequestException("Generate the quiz before submitting answers");
    }

    const answerMap = new Map(
      (answers || []).map((answer) => [
        String(answer?.questionId),
        Number(answer?.selectedIndex),
      ]),
    );

    const results = questions.map((question: any) => {
      const selectedIndex = answerMap.has(question.id)
        ? answerMap.get(question.id)!
        : -1;
      const correct = selectedIndex === question.correctIndex;

      return {
        question_id: question.id,
        prompt: question.prompt,
        options: question.options,
        selected_index: selectedIndex,
        correct_index: question.correctIndex,
        correct,
        explanation: question.explanation || "",
        gap_key: question.gapKey || "general",
      };
    });

    const correctCount = results.filter((result) => result.correct).length;
    const scorePercent = Math.round((correctCount / questions.length) * 100);
    const passed = scorePercent >= RecommendationService.QUIZ_PASS_PERCENT;

    const attempt = {
      attemptedAt: new Date().toISOString(),
      scorePercent,
      correctCount,
      total: questions.length,
      passed,
      answers: results.map((result) => ({
        questionId: result.question_id,
        selectedIndex: result.selected_index,
        correct: result.correct,
      })),
    };

    recommendation.quizAttempts = [
      ...(Array.isArray(recommendation.quizAttempts)
        ? recommendation.quizAttempts
        : []),
      attempt,
    ];

    if (passed) {
      recommendation.quizPassedAt = new Date();
      recommendation.status = "completed";
      recommendation.outcomeStatus = "resolved";
      recommendation.outcomeMetrics = {
        ...(recommendation.outcomeMetrics || {}),
        completedAt: attempt.attemptedAt,
        completedVia: "quiz",
        quizScorePercent: scorePercent,
      };
    }

    const saved = await this.recommendationRepo.save(recommendation);

    return {
      passed,
      score_percent: scorePercent,
      correct_count: correctCount,
      total: questions.length,
      pass_percent: RecommendationService.QUIZ_PASS_PERCENT,
      attempt_count: saved.quizAttempts.length,
      recommendation_status: saved.status,
      results,
    };
  }

  async getAvailableMentors() {
    const mentors = await this.fetchMentorCandidates();
    return mentors.map((mentor) => ({
      id: mentor.id,
      email: mentor.email,
      username: mentor.username || null,
      first_name: mentor.first_name || null,
      last_name: mentor.last_name || null,
      role: mentor.role,
      is_mentor: mentor.is_mentor,
      is_active: mentor.is_active,
      last_login_at: mentor.last_login_at || null,
    }));
  }

  async getMentorRequestsForDeveloper(developerId: string) {
    const requests = await this.mentorRequestRepo.find({
      where: { requesterDeveloperId: developerId },
      order: { createdAt: "DESC" },
    });

    return this.mapMentorRequests(requests);
  }

  async getMentorRequestsForMentor(mentorId: string) {
    const requests = await this.mentorRequestRepo.find({
      where: { mentorId, status: "pending" },
      order: { createdAt: "DESC" },
    });

    return this.mapMentorRequests(requests);
  }

  async requestMentor(
    recommendationId: string,
    developerId: string,
    mentorId: string,
  ) {
    const recommendation = await this.recommendationRepo.findOne({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new BadRequestException("Recommendation not found");
    }

    const requesterDeveloperId = recommendation.targetDeveloperId;
    if (developerId && developerId !== requesterDeveloperId) {
      this.logger.warn(
        `Mentor request developer id mismatch for recommendation ${recommendationId}: ` +
          `received=${developerId}, stored=${requesterDeveloperId}`,
      );
    }

    if (recommendation.recommendationType !== "mentorship") {
      throw new BadRequestException(
        "Only mentorship recommendations can be sent to a mentor",
      );
    }

    if (recommendation.mentorId) {
      throw new ConflictException("This recommendation already has a mentor");
    }

    const mentors = await this.fetchMentorCandidates();
    const mentor = mentors.find((candidate) => candidate.id === mentorId);

    if (!mentor) {
      throw new BadRequestException("Selected mentor is not available");
    }

    const existingPendingRequest = await this.mentorRequestRepo.findOne({
      where: { recommendationId, status: "pending" },
    });

    if (existingPendingRequest) {
      throw new ConflictException(
        "A mentor request is already pending for this recommendation",
      );
    }

    const requesterSnapshot = await this.fetchDeveloperSnapshot(
      requesterDeveloperId,
    );
    const request = this.mentorRequestRepo.create({
      recommendationId,
      requesterDeveloperId,
      mentorId,
      status: "pending",
      mentorSnapshot: {
        id: mentor.id,
        name: `${mentor.first_name || ""} ${mentor.last_name || ""}`.trim(),
        username: mentor.username || null,
        email: mentor.email,
        role: mentor.role,
      },
      requesterSnapshot,
      respondedAt: null,
    });

    const saved = await this.mentorRequestRepo.save(request);
    await this.emitMentorRequestNotification(saved, recommendation);
    return this.mapMentorRequest(saved, recommendation);
  }

  async respondToMentorRequest(
    requestId: string,
    mentorId: string,
    decision: "accepted" | "declined",
  ) {
    const request = await this.mentorRequestRepo.findOne({
      where: { id: requestId, mentorId },
    });

    if (!request) {
      throw new BadRequestException("Mentor request not found");
    }

    if (request.status !== "pending") {
      throw new ConflictException("Mentor request has already been resolved");
    }

    const recommendation = await this.recommendationRepo.findOne({
      where: { id: request.recommendationId },
    });

    if (!recommendation) {
      throw new BadRequestException("Recommendation not found");
    }

    if (recommendation.mentorId && recommendation.mentorId !== mentorId) {
      throw new ConflictException(
        "This recommendation has already been assigned to another mentor",
      );
    }

    if (decision === "accepted") {
      const mentors = await this.fetchMentorCandidates();
      const mentor = mentors.find((candidate) => candidate.id === mentorId);

      if (!mentor) {
        throw new BadRequestException("Mentor is not available anymore");
      }

      recommendation.mentorId = mentorId;
      recommendation.mentorSnapshot = {
        id: mentor.id,
        name: `${mentor.first_name || ""} ${mentor.last_name || ""}`.trim(),
        username: mentor.username || null,
        email: mentor.email,
        role: mentor.role,
      };
      recommendation.status = "assigned";
      recommendation.recommendationType = "mentorship";
      await this.recommendationRepo.save(recommendation);
      request.status = "accepted";
    } else {
      request.status = "declined";
    }

    request.respondedAt = new Date();
    const saved = await this.mentorRequestRepo.save(request);
    await this.emitMentorDecisionNotification(saved, recommendation, decision);

    return {
      request: this.mapMentorRequest(saved, recommendation),
      recommendation: this.mapCase(recommendation),
    };
  }

  private async emitMentorshipSessionScheduledNotification(
    recommendation: RecommendationCase,
  ) {
    if (!recommendation.mentorshipSessionScheduledAt) {
      return;
    }

    const scheduledAt = recommendation.mentorshipSessionScheduledAt;
    const formattedScheduledAt = scheduledAt.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });

    await this.sendNotification({
      recipientUserId: recommendation.targetDeveloperId,
      type: "mentorship_session_scheduled",
      title: "Mentorship session scheduled",
      message: `Your mentoring session for "${recommendation.title}" is scheduled for ${formattedScheduledAt} UTC.`,
      link: `/dashboard/developer/recommendations/${recommendation.id}`,
      priority: "high",
      metadata: {
        recommendationId: recommendation.id,
        mentorId: recommendation.mentorId,
        scheduledAt: scheduledAt.toISOString(),
        note: recommendation.mentorshipSessionNote,
      },
    });
  }
  private async mapMentorRequests(requests: MentorRequest[]) {
    const recommendations = await Promise.all(
      requests.map((request) =>
        this.recommendationRepo.findOne({
          where: { id: request.recommendationId },
        }),
      ),
    );

    return requests.map((request, index) =>
      this.mapMentorRequest(request, recommendations[index] || null),
    );
  }

  private mapMentorRequest(
    request: MentorRequest,
    recommendation: RecommendationCase | null,
  ) {
    return {
      id: request.id,
      recommendation_id: request.recommendationId,
      requester_developer_id: request.requesterDeveloperId,
      mentor_id: request.mentorId,
      status: request.status,
      mentor_snapshot: request.mentorSnapshot,
      requester_snapshot: request.requesterSnapshot,
      responded_at: request.respondedAt?.toISOString() || null,
      created_at: request.createdAt.toISOString(),
      updated_at: request.updatedAt.toISOString(),
      recommendation: recommendation ? this.mapCase(recommendation) : null,
    };
  }

  private async fetchDeveloperSnapshot(developerId: string) {
    try {
      const user = await firstValueFrom(
        this.developerService.send("get_user_by_id", {
          userId: developerId,
        }),
      );

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        name:
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.username ||
          user.email ||
          null,
        username: user.username || null,
        email: user.email || null,
        role: user.role || null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not resolve developer snapshot for mentor request: ${message}`,
      );
      return null;
    }
  }

  private async sendNotification(params: {
    recipientUserId: string;
    type: string;
    title: string;
    message: string;
    link?: string | null;
    priority?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const response = await fetch(
        `${this.notificationServiceBaseUrl}/notifications/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientUserId: params.recipientUserId,
            type: params.type,
            title: params.title,
            message: params.message,
            link: params.link || null,
            priority: params.priority || "info",
            metadata: params.metadata || {},
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        this.logger.warn(
          `Notification service rejected mentor workflow notification: ${response.status} ${errorText}`,
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to create mentor workflow notification: ${error?.message || error}`,
      );
    }
  }

  private async emitMentorRequestNotification(
    request: MentorRequest,
    recommendation: RecommendationCase,
  ) {
    const requester = request.requesterSnapshot;
    const mentor = request.mentorSnapshot;

    await this.sendNotification({
      recipientUserId: request.mentorId,
      type: "mentor_request_created",
      title: `Mentor request from ${requester?.name || `@${recommendation.contributorLogin}`}`,
      message: `${requester?.name || `@${recommendation.contributorLogin}`} asked for help with "${recommendation.title}".`,
      link: "/dashboard/tech_lead/recommendations",
      priority: "high",
      metadata: {
        requestId: request.id,
        recommendationId: recommendation.id,
        mentorId: mentor?.id || request.mentorId,
        requester,
        mentor,
      },
    });
  }

  private async emitMentorDecisionNotification(
    request: MentorRequest,
    recommendation: RecommendationCase,
    decision: "accepted" | "declined",
  ) {
    const isAccepted = decision === "accepted";
    await this.sendNotification({
      recipientUserId: request.requesterDeveloperId,
      type: isAccepted ? "mentor_request_accepted" : "mentor_request_declined",
      title: isAccepted
        ? "Mentorship request accepted"
        : "Mentorship request declined",
      message: isAccepted
        ? `A mentor accepted your request for "${recommendation.title}".`
        : `Your mentorship request for "${recommendation.title}" was declined.`,
      link: `/dashboard/developer/recommendations/${recommendation.id}`,
      priority: isAccepted ? "high" : "info",
      metadata: {
        requestId: request.id,
        recommendationId: recommendation.id,
        decision,
        mentorId: request.mentorId,
        requesterDeveloperId: request.requesterDeveloperId,
      },
    });
  }

  private async saveRecommendation(params: {
    existing: RecommendationCase | null;
    targetDeveloperId: string;
    contributorLogin: string;
    repositoryId: string;
    repoName: string;
    summary: AnalysisSummary;
    history: RecommendationHistorySnapshot[];
    generated: RecommendationGenerationResult;
    recommendationType: RecommendationType;
    analyzedAt?: string;
  }) {
    const recommendation = params.existing || this.recommendationRepo.create();
    const existingMentorId = recommendation.mentorId;
    const existingMentorSnapshot = recommendation.mentorSnapshot;
    const existingStatus = recommendation.status;
    const generatedAt = params.analyzedAt || new Date().toISOString();
    const priorityScore = this.computePriorityScore(
      params.summary,
      params.generated,
    );
    const qualityScore =
      typeof params.summary.quality_score === "number"
        ? params.summary.quality_score
        : null;

    recommendation.targetDeveloperId = params.targetDeveloperId;
    recommendation.repositoryId = params.repositoryId;
    recommendation.contributorLogin = params.contributorLogin;
    recommendation.recommendationType = params.recommendationType;
    recommendation.status =
      params.recommendationType === "mentorship" &&
      existingStatus === "assigned"
        ? "assigned"
        : "open";
    recommendation.priorityScore = priorityScore;
    recommendation.qualityScore = qualityScore;
    recommendation.title = this.buildRecommendationTitle(params);
    recommendation.description = this.buildRecommendationDescription(params);
    recommendation.mentorId =
      params.recommendationType === "mentorship"
        ? existingMentorId || null
        : null;
    recommendation.mentorSnapshot =
      params.recommendationType === "mentorship"
        ? existingMentorSnapshot || null
        : null;
    recommendation.contextSnapshot = this.buildContextSnapshot(
      params,
      generatedAt,
    );
    recommendation.evidenceSnapshot = this.buildEvidenceSnapshot(
      params.recommendationType,
      params.generated,
      params.summary,
    );
    recommendation.targetSkills = params.generated.detectedGaps.map(
      (gap) => gap.label,
    );
    recommendation.effortLevel = this.getEffortLevel(
      params.recommendationType,
      params.summary,
    );
    recommendation.dueInDays = this.getDueInDays(
      params.recommendationType,
      params.summary,
    );
    recommendation.confidenceScore = this.computeConfidenceScore(
      params.generated,
    );
    recommendation.learningPath =
      params.recommendationType === "learning_path"
        ? {
            overview: params.generated.generatedPath.summary,
            tone: params.generated.generatedPath.tone,
            estimatedTotalHours:
              params.generated.generatedPath.estimated_total_hours,
            steps: params.generated.generatedPath.steps,
          }
        : null;
    recommendation.docsReview =
      params.recommendationType === "docs_review"
        ? this.buildDocsReview(params.summary, params.generated)
        : null;
    recommendation.weaknessSnapshot = {
      topWeaknesses: params.generated.detectedGaps.map((gap) => ({
        skill: gap.label,
        score: gap.score,
      })),
      weaknessScores: params.summary.weakness_scores || {},
    };
    recommendation.decisionReasons = {
      pipeline: "atlas_vector_rag",
      recommendationType: params.recommendationType,
      routing: this.buildRoutingReasons(params.summary, params.generated),
      llm: {
        provider: params.generated.provider,
        model: params.generated.model,
      },
      generatedAt,
      gaps: params.generated.detectedGaps,
      courseMatches: params.generated.gapMatches.map((match) => ({
        gap: match.gap.label,
        courseCount: match.courses.length,
        courseIds: match.courses.map((course) => course.courseId),
      })),
    };
    recommendation.analysisSummary = params.summary as Record<string, any>;
    recommendation.previousRecommendationId =
      params.history.find((item) => item.id !== recommendation.id)?.id || null;
    recommendation.outcomeStatus = "pending";
    recommendation.outcomeMetrics = {
      lastGeneratedAt: generatedAt,
      previousRecommendationCount: params.history.length,
      detectedGapCount: params.generated.detectedGaps.length,
      recommendationType: params.recommendationType,
      llmProvider: params.generated.provider,
      llmModel: params.generated.model,
    };

    return this.recommendationRepo.save(recommendation);
  }

  private buildContextSnapshot(
    params: {
      repoName: string;
      contributorLogin: string;
      summary: AnalysisSummary;
      generated: RecommendationGenerationResult;
    },
    generatedAt: string,
  ) {
    return {
      repoName: params.repoName,
      contributorLogin: params.contributorLogin,
      dominantLanguage: params.summary.dominant_language || null,
      commitTopics: Array.isArray(params.summary.commit_topics)
        ? params.summary.commit_topics
        : [],
      strengths: Array.isArray(params.summary.strengths)
        ? params.summary.strengths
        : [],
      detectedGaps: params.generated.detectedGaps,
      llmProvider: params.generated.provider,
      llmModel: params.generated.model,
      generatedAt,
      profileSignals:
        params.summary.analysis_metadata?.skill_profile_inputs || {},
    };
  }

  private buildEvidenceSnapshot(
    recommendationType: RecommendationType,
    generated: RecommendationGenerationResult,
    summary: AnalysisSummary,
  ) {
    return {
      recommendationType,
      topWeaknesses: generated.detectedGaps.map((gap) => ({
        skill: gap.label,
        score: gap.score,
      })),
      keyFindings: (summary.findings || []).slice(0, 6).map((finding) => ({
        title: finding.title,
        skill: finding.skill,
        severity: finding.severity,
        confidence: finding.confidence,
        file: finding.file_path,
      })),
      strengths: Array.isArray(summary.strengths)
        ? summary.strengths.slice(0, 5)
        : [],
      successCriteria: this.buildSuccessCriteria(
        recommendationType,
        generated,
        summary,
      ),
      retrievedCoursesByGap: generated.gapMatches.map((match) => ({
        gapKey: match.gap.key,
        gapLabel: match.gap.label,
        courses: match.courses,
      })),
    };
  }

  private async findActiveRecommendation(
    targetDeveloperId: string,
    repositoryId: string,
    contributorLogin: string,
    recommendationType: RecommendationType,
  ) {
    return this.recommendationRepo.findOne({
      where: {
        targetDeveloperId,
        repositoryId,
        contributorLogin,
        recommendationType,
        status: In(["open", "assigned"]),
      },
      order: { updatedAt: "DESC" },
    });
  }

  private determineRecommendationType(
    summary: AnalysisSummary,
    generated: RecommendationGenerationResult,
  ): RecommendationType {
    const qualityScore = this.getQualityScore(summary);
    const counts = this.getFindingCounts(summary);
    const hasCriticalGap = generated.detectedGaps.some(
      (gap) => gap.severity === "critical",
    );
    const severeGapCount = generated.detectedGaps.filter((gap) =>
      ["critical", "high"].includes(gap.severity),
    ).length;

    if (
      (typeof qualityScore === "number" && qualityScore <= 3.5) || // raised from 4.5
      counts.critical > 2 ||
      counts.high >= 5 || // raised from 3
      hasCriticalGap ||
      severeGapCount >= 5 // raised from 3
      // removed the qualityScore <= 5.5 && counts.high > 1 clause entirely
    ) {
      return "mentorship";
    }

    if (this.hasDocsReviewSignal(summary, generated, qualityScore)) {
      return "docs_review";
    }

    return "learning_path";
  }

  private buildRecommendationTitle(params: {
    contributorLogin: string;
    recommendationType: RecommendationType;
    generated: RecommendationGenerationResult;
  }) {
    if (params.recommendationType === "mentorship") {
      return `Mentoring recommended for @${params.contributorLogin}`;
    }

    if (params.recommendationType === "docs_review") {
      return `Quick docs review for @${params.contributorLogin}`;
    }

    return params.generated.generatedPath.title;
  }

  private buildRecommendationDescription(params: {
    recommendationType: RecommendationType;
    summary: AnalysisSummary;
    generated: RecommendationGenerationResult;
  }) {
    const qualityScore = this.getQualityScore(params.summary);
    const qualityText =
      typeof qualityScore === "number"
        ? ` Quality score: ${qualityScore.toFixed(1)}/10.`
        : "";

    if (params.recommendationType === "mentorship") {
      const counts = this.getFindingCounts(params.summary);
      return `Guided mentoring is recommended because the latest analysis found ${counts.critical} critical and ${counts.high} high-severity issue(s).${qualityText}`;
    }

    if (params.recommendationType === "docs_review") {
      const focusAreas = params.generated.detectedGaps
        .slice(0, 3)
        .map((gap) => gap.label)
        .join(", ");
      return `Run a focused docs and readability review for ${focusAreas || "the latest code-analysis findings"}.${qualityText}`;
    }

    return params.generated.generatedPath.summary;
  }

  private buildDocsReview(
    summary: AnalysisSummary,
    generated: RecommendationGenerationResult,
  ) {
    const findings = Array.isArray(summary.findings) ? summary.findings : [];
    const orderedFindings = findings
      .slice()
      .sort((left, right) => {
        const leftDocs = this.isDocumentationSignal(
          `${left.skill} ${left.title} ${left.message}`,
        )
          ? 1
          : 0;
        const rightDocs = this.isDocumentationSignal(
          `${right.skill} ${right.title} ${right.message}`,
        )
          ? 1
          : 0;
        return (
          rightDocs - leftDocs ||
          this.severityRank(right.severity) - this.severityRank(left.severity)
        );
      })
      .slice(0, 5);

    const checklist =
      orderedFindings.length > 0
        ? orderedFindings.map((finding) => ({
            title: finding.title || `Review ${this.humanize(finding.skill)}`,
            skill: this.humanize(finding.skill || "documentation_readability"),
            file: finding.file_path || "Repository-wide",
            note:
              finding.message ||
              `Review this ${finding.severity || "medium"} finding and clarify the related implementation notes.`,
            success_criteria:
              "The relevant docs, comments, naming, or review notes clearly explain the behavior and expected outcome.",
          }))
        : generated.detectedGaps.slice(0, 5).map((gap) => ({
            title: `Review ${gap.label}`,
            skill: gap.label,
            file: "Repository-wide",
            note:
              gap.evidence[0] ||
              "Add a short review note that explains the gap and the expected follow-up.",
            success_criteria:
              "The reviewer can understand the issue, expected fix, and validation step without extra context.",
          }));

    return {
      checklist,
      focus_areas: generated.detectedGaps.slice(0, 4).map((gap) => gap.label),
      resources: (Array.isArray(summary.learning_resources)
        ? summary.learning_resources
        : []
      )
        .filter((resource) =>
          this.isDocumentationSignal(
            `${resource.skill} ${resource.title} ${resource.type}`,
          ),
        )
        .slice(0, 3)
        .map((resource) => ({
          title: resource.title,
          type: resource.type,
          url: resource.url,
        })),
    };
  }

  private buildSuccessCriteria(
    recommendationType: RecommendationType,
    generated: RecommendationGenerationResult,
    summary: AnalysisSummary,
  ) {
    if (recommendationType === "docs_review") {
      return this.buildDocsReview(summary, generated).checklist.map(
        (item) => item.success_criteria,
      );
    }

    if (recommendationType === "mentorship") {
      return [
        "A mentor reviews the highest-severity finding with the contributor.",
        "The contributor ships a follow-up change that addresses the root cause.",
        ...generated.generatedPath.steps
          .slice(0, 2)
          .map((step) => step.success_signal),
      ];
    }

    return generated.generatedPath.steps.map((step) => step.success_signal);
  }

  private buildRoutingReasons(
    summary: AnalysisSummary,
    generated: RecommendationGenerationResult,
  ) {
    const qualityScore = this.getQualityScore(summary);
    const counts = this.getFindingCounts(summary);

    return {
      qualityScore,
      findingCounts: counts,
      hasDocumentationSignal: this.hasDocsReviewSignal(
        summary,
        generated,
        qualityScore,
      ),
      topGapSeverities: generated.detectedGaps.map((gap) => ({
        gap: gap.label,
        severity: gap.severity,
        score: gap.score,
      })),
    };
  }

  private hasDocsReviewSignal(
    summary: AnalysisSummary,
    generated: RecommendationGenerationResult,
    qualityScore: number | null,
  ) {
    const findings = Array.isArray(summary.findings) ? summary.findings : [];
    const counts = this.getFindingCounts(summary);

    // Doc signal must dominate: majority of gaps/findings must be doc-related
    const docGapCount = generated.detectedGaps.filter((gap) =>
      this.isDocumentationSignal(`${gap.key} ${gap.label}`),
    ).length;
    const totalGaps = generated.detectedGaps.length;
    const docFindingCount = findings.filter((f) =>
      this.isDocumentationSignal(`${f.skill} ${f.title} ${f.message}`),
    ).length;

    const docIsDominant =
      totalGaps > 0 && docGapCount / totalGaps >= 0.5 && docGapCount >= 2;
    const docFindingsDominant =
      findings.length > 0 &&
      docFindingCount / findings.length >= 0.5 &&
      docFindingCount >= 2;

    if (docIsDominant || docFindingsDominant) {
      return true;
    }

    // Score-based: only for genuinely good code with minor findings
    return (
      typeof qualityScore === "number" &&
      qualityScore >= 7 && // raised from 6
      counts.critical === 0 &&
      counts.high === 0 &&
      counts.medium <= 2 && // added: too many medium findings → learning_path
      generated.detectedGaps.length > 0
    );
  }

  private isDocumentationSignal(value: string) {
    return /doc|readability|comment|naming|explain|clarity|technical_documentation/i.test(
      value || "",
    );
  }

  private getQualityScore(summary: AnalysisSummary) {
    return typeof summary.quality_score === "number"
      ? summary.quality_score
      : null;
  }

  private getFindingCounts(summary: AnalysisSummary) {
    const counts = summary.summary || {};
    const findings = Array.isArray(summary.findings) ? summary.findings : [];

    return {
      findingCount:
        typeof counts.finding_count === "number"
          ? counts.finding_count
          : findings.length,
      critical:
        typeof counts.critical_count === "number"
          ? counts.critical_count
          : findings.filter((finding) => finding.severity === "critical")
              .length,
      high:
        typeof counts.high_count === "number"
          ? counts.high_count
          : findings.filter((finding) => finding.severity === "high").length,
      medium:
        typeof counts.medium_count === "number"
          ? counts.medium_count
          : findings.filter((finding) => finding.severity === "medium").length,
      low:
        typeof counts.low_count === "number"
          ? counts.low_count
          : findings.filter((finding) => finding.severity === "low").length,
    };
  }

  private getEffortLevel(
    recommendationType: RecommendationType,
    summary: AnalysisSummary,
  ) {
    if (recommendationType === "mentorship") {
      return "intensive";
    }

    if (recommendationType === "docs_review") {
      return "light";
    }

    return (summary.summary?.critical_count || 0) > 0
      ? "intensive"
      : "moderate";
  }

  private getDueInDays(
    recommendationType: RecommendationType,
    summary: AnalysisSummary,
  ) {
    if (recommendationType === "mentorship") {
      return 10;
    }

    if (recommendationType === "docs_review") {
      return 5;
    }

    return (summary.summary?.critical_count || 0) > 0 ? 10 : 21;
  }

  private severityRank(severity: string | undefined | null) {
    switch (severity) {
      case "critical":
        return 4;
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      default:
        return 0;
    }
  }

  private humanize(value: string) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private computePriorityScore(
    summary: AnalysisSummary,
    generated: RecommendationGenerationResult,
  ) {
    const counts = summary.summary || {};
    const critical = counts.critical_count || 0;
    const high = counts.high_count || 0;
    const gapWeight = generated.detectedGaps.reduce(
      (total, gap) => total + Math.min(12, gap.score * 1.6),
      0,
    );

    return Math.max(
      10,
      Math.min(100, Math.round(28 + critical * 18 + high * 10 + gapWeight)),
    );
  }

  private computeConfidenceScore(generated: RecommendationGenerationResult) {
    const matchCoverage =
      generated.gapMatches.length === 0
        ? 0
        : generated.gapMatches.filter((match) => match.courses.length > 0)
            .length / generated.gapMatches.length;
    const providerPenalty = generated.provider === "fallback" ? 0.08 : 0;
    return Number(
      Math.max(
        0.5,
        Math.min(0.94, 0.58 + matchCoverage * 0.24 - providerPenalty),
      ).toFixed(2),
    );
  }

  private async emitNotificationEvent(
    recommendation: RecommendationCase,
    generated: RecommendationGenerationResult,
    regenerated = false,
  ) {
    const event = {
      type: `${recommendation.recommendationType}_ready`,
      recommendationId: recommendation.id,
      developerId: recommendation.targetDeveloperId,
      repositoryId: recommendation.repositoryId,
      contributorLogin: recommendation.contributorLogin,
      title: recommendation.title,
      summary: this.buildNotificationSummary(recommendation, generated),
      regenerated,
      createdAt: new Date().toISOString(),
    };

    await this.createDeveloperNotification(event);
  }

  private buildNotificationSummary(
    recommendation: RecommendationCase,
    generated: RecommendationGenerationResult,
  ) {
    if (recommendation.recommendationType === "mentorship") {
      return "Mentoring is recommended based on the latest code-analysis severity and quality score.";
    }

    if (recommendation.recommendationType === "docs_review") {
      return "A quick docs review is recommended for the latest code-analysis findings.";
    }

    return generated.notificationSummary;
  }

  private async fetchLatestAnalysisSummary(
    targetDeveloperId: string,
    repositoryId: string,
    contributorLogin: string,
    fallbackSummary: AnalysisSummary | null | undefined,
  ): Promise<AnalysisSummary> {
    try {
      const repository = await firstValueFrom(
        this.developerService.send("github_get_repository", {
          userId: targetDeveloperId,
          repositoryId,
        }),
      );

      const normalizedLogin = this.normalizeContributorLogin(contributorLogin);
      const contributorProfiles =
        repository?.analysis_metadata?.contributorProfiles || {};
      const profile = contributorProfiles[normalizedLogin] || null;

      const profileSummary =
        profile?.analysisSummary ||
        profile?.analysis_summary ||
        repository?.analysis_summary ||
        null;

      if (profileSummary && typeof profileSummary === "object") {
        return profileSummary as AnalysisSummary;
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to fetch latest analysis snapshot for regeneration: ${error?.message || error}`,
      );
    }

    if (fallbackSummary && typeof fallbackSummary === "object") {
      return fallbackSummary;
    }

    throw new BadRequestException(
      "No analysis summary available to regenerate this recommendation",
    );
  }

  private async getRecommendationHistory(
    targetDeveloperId: string,
    contributorLogin: string,
    repositoryId: string,
  ): Promise<RecommendationHistorySnapshot[]> {
    const rows = await this.recommendationRepo.find({
      where: {
        targetDeveloperId,
        contributorLogin,
        repositoryId,
      },
      order: { createdAt: "DESC" },
      take: 8,
    });

    return rows.map((row) => ({
      id: row.id,
      recommendationType: row.recommendationType,
      status: row.status,
      qualityScore: row.qualityScore,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async fetchMentorCandidates(): Promise<MentorCandidate[]> {
    try {
      const response = await firstValueFrom(
        this.developerService.send("developer_get_available_mentors", {}),
      );

      if (!Array.isArray(response)) {
        return [];
      }

      return response.filter(
        (mentor) =>
          mentor?.is_active &&
          mentor?.role === "tech_lead" &&
          mentor?.is_mentor === true,
      );
    } catch (error) {
      this.logger.warn(
        "Could not fetch mentor candidates from developer-service",
      );
      return [];
    }
  }

  private async createDeveloperNotification(event: Record<string, any>) {
    const recipientUserId =
      (await this.resolveDeveloperIdFromContributor(event.contributorLogin)) ||
      event.developerId;

    if (!this.isUuid(recipientUserId)) {
      this.logger.warn(
        `Skipping developer notification for @${event.contributorLogin || "unknown"}: no platform user id`,
      );
      return;
    }

    try {
      const response = await fetch(
        `${this.notificationServiceBaseUrl}/notifications/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientUserId,
            type: event.type,
            title: event.title || "Recommendation ready",
            message:
              event.summary ||
              "A new recommendation is ready for your developer profile.",
            link: "/dashboard/developer/recommendations",
            priority: "info",
            metadata: event,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        this.logger.warn(
          `Notification service rejected developer notification: ${response.status} ${errorText}`,
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to create developer notification: ${error?.message || error}`,
      );
    }
  }

  private async resolveDeveloperIdFromContributor(
    contributorLogin?: string | null,
  ) {
    const normalizedLogin = this.normalizeContributorLogin(contributorLogin);
    if (!normalizedLogin) {
      return null;
    }

    try {
      const integration = await firstValueFrom(
        this.developerService.send("github_find_integration_by_username", {
          githubUsername: normalizedLogin,
        }),
      );

      return integration?.developer_id || integration?.developerId || null;
    } catch (error: any) {
      this.logger.warn(
        `Could not resolve developer notification recipient for @${normalizedLogin}: ${
          error?.message || error
        }`,
      );
      return null;
    }
  }

  private assertTechLeadCanViewRecommendation(
    recommendation: RecommendationCase,
    requesterId: string,
  ) {
    if (recommendation.recommendationType !== "mentorship") {
      throw new ForbiddenException("You do not have access to this recommendation");
    }

    if (recommendation.mentorId && recommendation.mentorId !== requesterId) {
      throw new ForbiddenException(
        "This recommendation is assigned to another mentor",
      );
    }
  }

  private assertDeveloperCanViewRecommendation(
    recommendation: RecommendationCase,
    requesterId: string,
    contributorLogin?: string,
  ) {
    const normalizedContributor = this.normalizeContributorLogin(contributorLogin);
    const ownsByDeveloperId = recommendation.targetDeveloperId === requesterId;
    const ownsByContributorLogin =
      Boolean(normalizedContributor) &&
      recommendation.contributorLogin === normalizedContributor;

    if (ownsByDeveloperId || ownsByContributorLogin) {
      return;
    }

    throw new ForbiddenException("You do not have access to this recommendation");
  }

  private mapCase(record: RecommendationCase) {
    return {
      id: record.id,
      target_developer_id: record.targetDeveloperId,
      repository_id: record.repositoryId,
      contributor_login: record.contributorLogin,
      recommendation_type: record.recommendationType,
      status: record.status,
      priority_score: record.priorityScore,
      quality_score: record.qualityScore,
      title: record.title,
      description: record.description,
      mentor_id: record.mentorId,
      mentor_snapshot: record.mentorSnapshot,
      mentorship_session_scheduled_at:
        record.mentorshipSessionScheduledAt?.toISOString() || null,
      mentorship_session_note: record.mentorshipSessionNote,
      mentorship_session_mode: record.mentorshipSessionMode,
      mentorship_session_location: record.mentorshipSessionLocation,
      mentorship_session_join_url: record.mentorshipSessionJoinUrl,
      context_snapshot: record.contextSnapshot,
      evidence_snapshot: record.evidenceSnapshot,
      target_skills: record.targetSkills,
      effort_level: record.effortLevel,
      due_in_days: record.dueInDays,
      confidence_score: record.confidenceScore,
      learning_path: record.learningPath,
      docs_review: record.docsReview,
      weakness_snapshot: record.weaknessSnapshot,
      decision_reasons: record.decisionReasons,
      analysis_summary: record.analysisSummary,
      previous_recommendation_id: record.previousRecommendationId,
      outcome_status: record.outcomeStatus,
      outcome_metrics: record.outcomeMetrics,
      feedback: record.feedback,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    };
  }

  private resolveTargetDeveloperId(
    payload: AnalysisCompletedEvent,
  ): string | null {
    if (this.isUuid(payload.requestedByUserId)) {
      return payload.requestedByUserId as string;
    }

    if (this.isUuid(payload.developerId)) {
      return payload.developerId as string;
    }

    return null;
  }

  private resolveContributorLogin(
    payload: AnalysisCompletedEvent,
    developerId: string,
  ) {
    const normalized = this.normalizeContributorLogin(payload.githubUsername);
    if (normalized) {
      return normalized;
    }

    return `developer-${developerId.slice(0, 8)}`;
  }

  private normalizeContributorLogin(login: string | undefined | null) {
    return String(login || "")
      .trim()
      .toLowerCase();
  }

  private isUuid(value: string | undefined | null) {
    if (!value) {
      return false;
    }

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
