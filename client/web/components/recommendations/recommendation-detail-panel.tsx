"use client";

import { ReactNode } from "react";
import {
  ArrowUpRight,
  Bot,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  FileText,
  Flame,
  GitBranch,
  Layers3,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type RecommendationCase,
  formatLabel,
  recommendationStatusTone,
  recommendationTypeTone,
} from "@/app/dashboard/admin/profiles/profile-types";

interface RecommendationDetailPanelProps {
  recommendation: RecommendationCase;
  repositoryName?: string;
  actions?: ReactNode;
  compact?: boolean;
}

const metricCardTone =
  "rounded-3xl border border-border/60 bg-muted/20 p-4 shadow-sm";

const labelMuted = "text-xs uppercase tracking-[0.2em] text-muted-foreground";

export function RecommendationDetailPanel({
  recommendation,
  repositoryName,
  actions,
  compact = false,
}: RecommendationDetailPanelProps) {
  const context = recommendation.context_snapshot || null;
  const evidence = recommendation.evidence_snapshot || null;
  const decision = recommendation.decision_reasons || null;
  const gapCards = context?.detectedGaps || [];
  const retrievedCoursesByGap =
    recommendation.recommendation_type === "learning_path"
      ? evidence?.retrievedCoursesByGap || []
      : [];
  const learningSteps = recommendation.learning_path?.steps || [];
  const docsReview = recommendation.docs_review || null;
  const scheduledSession = recommendation.mentorship_session_scheduled_at
    ? new Date(recommendation.mentorship_session_scheduled_at)
    : null;
  const scheduledSessionLabel = scheduledSession
    ? scheduledSession.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  const generatedAt = context?.generatedAt;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/60 bg-background/90 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    recommendationTypeTone[recommendation.recommendation_type]
                  }
                >
                  {formatLabel(recommendation.recommendation_type)}
                </Badge>
                <Badge
                  variant="outline"
                  className={recommendationStatusTone(recommendation.status)}
                >
                  {formatLabel(recommendation.status)}
                </Badge>
                {context?.llmProvider ? (
                  <Badge variant="secondary">
                    {formatLabel(context.llmProvider)} •{" "}
                    {context.llmModel || "model"}
                  </Badge>
                ) : null}
              </div>

              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {recommendation.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {recommendation.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Repo{" "}
                  <span className="font-medium text-foreground">
                    {repositoryName || recommendation.repository_id}
                  </span>
                </span>
                <span className="hidden sm:inline">•</span>
                <span>
                  Contributor{" "}
                  <span className="font-medium text-foreground">
                    @{recommendation.contributor_login}
                  </span>
                </span>
                {context?.dominantLanguage ? (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span>
                      Language{" "}
                      <span className="font-medium text-foreground">
                        {formatLabel(context.dominantLanguage)}
                      </span>
                    </span>
                  </>
                ) : null}
                {generatedAt ? (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span>
                      Generated{" "}
                      <span className="font-medium text-foreground">
                        {new Date(generatedAt).toLocaleDateString()}
                      </span>
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            {actions ? (
              <div className="flex flex-wrap gap-2">{actions}</div>
            ) : null}
          </div>

          <div
            className={`mt-6 grid gap-3 ${compact ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-5"}`}
          >
            <div className={metricCardTone}>
              <p className={labelMuted}>Priority</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-semibold">
                <Flame className="h-5 w-5 text-amber-500" />
                {recommendation.priority_score}
              </p>
            </div>
            <div className={metricCardTone}>
              <p className={labelMuted}>Quality score</p>
              <p className="mt-2 text-2xl font-semibold">
                {typeof recommendation.quality_score === "number"
                  ? `${recommendation.quality_score.toFixed(2)}/10`
                  : "--"}
              </p>
            </div>
            <div className={metricCardTone}>
              <p className={labelMuted}>Confidence</p>
              <p className="mt-2 text-2xl font-semibold">
                {typeof recommendation.confidence_score === "number"
                  ? `${Math.round(recommendation.confidence_score * 100)}%`
                  : "--"}
              </p>
            </div>
            <div className={metricCardTone}>
              <p className={labelMuted}>Effort</p>
              <p className="mt-2 text-2xl font-semibold capitalize">
                {recommendation.effort_level
                  ? formatLabel(recommendation.effort_level)
                  : "--"}
              </p>
            </div>
            {!compact ? (
              <div className={metricCardTone}>
                <p className={labelMuted}>Due window</p>
                <p className="mt-2 flex items-center gap-2 text-2xl font-semibold">
                  <CalendarClock className="h-5 w-5 text-cyan-600" />
                  {typeof recommendation.due_in_days === "number"
                    ? `${recommendation.due_in_days}d`
                    : "--"}
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          {gapCards.length ? (
            <Card className="border-border/60 bg-background/85 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5" />
                  Detected gaps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gapCards.map((gap) => (
                  <div
                    key={`${recommendation.id}-${gap.key}`}
                    className="rounded-3xl border border-border/60 bg-muted/15 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {gap.label}
                        </p>
                        {gap.evidence?.length ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {gap.evidence[0]}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{gap.score.toFixed(2)}</Badge>
                        <Badge variant="secondary">
                          {formatLabel(gap.severity)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {evidence?.keyFindings?.length ? (
            <Card className="border-border/60 bg-background/85 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5" />
                  Recent evidence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidence.keyFindings.slice(0, 5).map((finding, index) => (
                  <div
                    key={`${recommendation.id}-finding-${index}`}
                    className="rounded-3xl border border-border/60 bg-muted/15 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {finding.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatLabel(finding.skill)} • {finding.file}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {formatLabel(finding.severity)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {retrievedCoursesByGap.length ? (
            <Card className="border-border/60 bg-background/85 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Layers3 className="h-5 w-5" />
                  Retrieved course matches
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {retrievedCoursesByGap.map((match) => (
                  <div
                    key={`${recommendation.id}-${match.gapKey}`}
                    className="rounded-3xl border border-border/60 bg-muted/15 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">
                        {match.gapLabel}
                      </p>
                      <Badge variant="secondary">
                        {match.courses.length} course
                        {match.courses.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {match.courses.slice(0, 3).map((course) => (
                        <a
                          key={`${recommendation.id}-${match.gapKey}-${course.courseId}`}
                          href={course.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-2xl border border-border/60 bg-background/90 p-4 transition hover:border-primary/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {course.title}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {course.partner || "Coursera"} •{" "}
                                {course.type || "course"}
                                {typeof course.rating === "number"
                                  ? ` • ${course.rating.toFixed(2)} rating`
                                  : ""}
                              </p>
                            </div>
                            <ArrowUpRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          </div>
                          {course.description ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {course.description}
                            </p>
                          ) : null}
                          {course.skills?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {course.skills.slice(0, 4).map((skill) => (
                                <Badge
                                  key={`${course.courseId}-${skill}`}
                                  variant="outline"
                                >
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {recommendation.recommendation_type === "mentorship" ? (
            <Card className="border-violet-500/25 bg-violet-500/5 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserRound className="h-5 w-5" />
                  Mentorship path
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {recommendation.mentor_snapshot?.name
                    ? `Assigned mentor: ${recommendation.mentor_snapshot.name}${recommendation.mentor_snapshot.email ? ` (${recommendation.mentor_snapshot.email})` : ""}`
                    : "A mentor is attached when the recommendation needs direct guided coaching."}
                </p>
                {scheduledSessionLabel ? (
                  <div className="rounded-2xl border border-violet-500/20 bg-background/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CalendarClock className="h-4 w-4 text-violet-600" />
                      Session scheduled
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {scheduledSessionLabel}
                    </p>
                    {recommendation.mentorship_session_note ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {recommendation.mentorship_session_note}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {recommendation.recommendation_type === "docs_review" &&
          docsReview?.checklist?.length ? (
            <Card className="border-emerald-500/25 bg-emerald-500/5 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Quick docs review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {docsReview.focus_areas?.length ? (
                  <div className="rounded-3xl border border-emerald-500/20 bg-background/80 p-4">
                    <p className={labelMuted}>Focus Areas</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {docsReview.focus_areas.map((area) => (
                        <Badge
                          key={`${recommendation.id}-docs-${area}`}
                          variant="outline"
                        >
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {docsReview.checklist.map((item, index) => (
                  <div
                    key={`${recommendation.id}-docs-review-${index}`}
                    className="rounded-3xl border border-border/60 bg-background/90 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {item.file || "Repository-wide"}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-foreground">
                          {item.title}
                        </h3>
                      </div>
                      {item.skill ? (
                        <Badge variant="secondary">
                          {formatLabel(item.skill)}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {item.note}
                    </p>
                    {item.success_criteria ? (
                      <div className="mt-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
                        <p className={labelMuted}>Success Signal</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.success_criteria}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}

                {docsReview.resources?.length ? (
                  <div className="space-y-3">
                    <p className={labelMuted}>Resources</p>
                    {docsReview.resources.map((resource) => (
                      <a
                        key={`${recommendation.id}-docs-resource-${resource.url}`}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-2xl border border-border/60 bg-background/90 p-4 transition hover:border-primary/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">
                              {resource.title}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {resource.type || "resource"}
                            </p>
                          </div>
                          <ArrowUpRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        </div>
                      </a>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {learningSteps.length ? (
            <Card className="border-cyan-500/25 bg-cyan-500/5 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5" />
                  Generated learning path
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recommendation.learning_path?.overview ? (
                  <div className="rounded-3xl border border-cyan-500/20 bg-background/80 p-4">
                    <p className="text-sm text-muted-foreground">
                      {recommendation.learning_path.overview}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {typeof recommendation.learning_path
                        .estimatedTotalHours === "number" ? (
                        <span>
                          Estimated effort{" "}
                          <span className="font-medium text-foreground">
                            {recommendation.learning_path.estimatedTotalHours}h
                          </span>
                        </span>
                      ) : null}
                      {recommendation.learning_path.tone ? (
                        <span>
                          Tone{" "}
                          <span className="font-medium text-foreground">
                            {recommendation.learning_path.tone}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {learningSteps.map((step) => (
                  <div
                    key={`${recommendation.id}-step-${step.order}`}
                    className="rounded-3xl border border-border/60 bg-background/90 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Step {step.order}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-foreground">
                          {step.title ||
                            formatLabel(step.skill || `step_${step.order}`)}
                        </h3>
                      </div>
                      {typeof step.estimated_hours === "number" ? (
                        <Badge variant="outline">{step.estimated_hours}h</Badge>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-3 text-sm">
                      <div>
                        <p className={labelMuted}>Goal</p>
                        <p className="mt-1 text-muted-foreground">
                          {step.goal}
                        </p>
                      </div>
                      {step.why_it_matters ? (
                        <div>
                          <p className={labelMuted}>Why It Matters</p>
                          <p className="mt-1 text-muted-foreground">
                            {step.why_it_matters}
                          </p>
                        </div>
                      ) : null}
                      {step.practice_task ? (
                        <div>
                          <p className={labelMuted}>Practice Task</p>
                          <p className="mt-1 text-muted-foreground">
                            {step.practice_task}
                          </p>
                        </div>
                      ) : null}
                      {step.success_signal ? (
                        <div>
                          <p className={labelMuted}>Success Signal</p>
                          <p className="mt-1 text-muted-foreground">
                            {step.success_signal}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {step.recommended_courses?.length ? (
                      <div className="mt-4 space-y-3">
                        <p className={labelMuted}>Recommended Courses</p>
                        {step.recommended_courses.map((course) => (
                          <a
                            key={`${recommendation.id}-${step.order}-${course.courseId}`}
                            href={course.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-2xl border border-border/60 bg-muted/10 p-4 transition hover:border-primary/40"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">
                                  {course.title}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {course.partner || "Coursera"} •{" "}
                                  {course.type || "course"}
                                </p>
                              </div>
                              <ArrowUpRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {(context?.strengths?.length || context?.commitTopics?.length) &&
          !compact ? (
            <Card className="border-border/60 bg-background/85 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GitBranch className="h-5 w-5" />
                  Context signals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {context?.strengths?.length ? (
                  <div>
                    <p className={labelMuted}>Observed strengths</p>
                    <div className="mt-2 space-y-2">
                      {context.strengths.map((strength, index) => (
                        <p
                          key={`${recommendation.id}-strength-${index}`}
                          className="rounded-3xl border border-border/60 bg-muted/15 p-3 text-sm text-muted-foreground"
                        >
                          {strength}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {context?.commitTopics?.length ? (
                  <div>
                    <p className={labelMuted}>Recent topics</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {context.commitTopics.map((topic) => (
                        <Badge
                          key={`${recommendation.id}-topic-${topic}`}
                          variant="outline"
                        >
                          {formatLabel(topic)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          {evidence?.successCriteria?.length ? (
            <Card className="border-border/60 bg-background/85 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5" />
                  Success criteria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidence.successCriteria.map((criterion, index) => (
                  <div
                    key={`${recommendation.id}-criterion-${index}`}
                    className="rounded-3xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground"
                  >
                    {criterion}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
          {/* {decision ? (
            <Card className="border-border/60 bg-background/85 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5" />
                  Generation details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-3xl border border-border/60 bg-muted/15 p-4">
                  <p className={labelMuted}>Pipeline</p>
                  <p className="mt-1 font-medium text-foreground">
                    {decision.pipeline || "Recommendation pipeline"}
                  </p>
                </div>
                {decision.llm ? (
                  <div className="rounded-3xl border border-border/60 bg-muted/15 p-4">
                    <p className={labelMuted}>LLM</p>
                    <p className="mt-1 font-medium text-foreground">
                      {formatLabel(decision.llm.provider || "provider")} •{" "}
                      {decision.llm.model || "model"}
                    </p>
                  </div>
                ) : null}
                {Array.isArray(decision.courseMatches) ? (
                  <div className="rounded-3xl border border-border/60 bg-muted/15 p-4">
                    <p className={labelMuted}>Retrieved coverage</p>
                    <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {decision.courseMatches.map((item: any, index: number) => (
                        <p key={`${recommendation.id}-coverage-${index}`}>
                          {item.gap}: {item.courseCount} course
                          {item.courseCount === 1 ? "" : "s"}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null} */}
        </div>
      </div>
    </div>
  );
}
