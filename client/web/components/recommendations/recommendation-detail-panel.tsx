"use client";

import { ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Flame,
  GaugeCircle,
  GitBranch,
  Layers3,
  Lightbulb,
  Target,
  Timer,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type RecommendationCase,
  type Severity,
  formatLabel,
  priorityBand,
  recommendationStatusTone,
  recommendationTypeTone,
  severityTone,
} from "@/app/dashboard/admin/profiles/profile-types";
import { cn } from "@/lib/utils";

interface RecommendationDetailPanelProps {
  recommendation: RecommendationCase;
  repositoryName?: string;
  actions?: ReactNode;
  compact?: boolean;
}

const labelMuted = "text-xs uppercase tracking-[0.16em] text-muted-foreground";

const severityRank: Record<Severity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

const qualityTone = (score: number | null | undefined) => {
  if (typeof score !== "number") return "text-foreground";
  if (score < 4) return "text-rose-600 dark:text-rose-400";
  if (score < 7) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

const confidenceTone = (score: number | null | undefined) => {
  if (typeof score !== "number") return "text-foreground";
  if (score < 0.5) return "text-rose-600 dark:text-rose-400";
  if (score < 0.75) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

const dueTone = (days: number | null | undefined) => {
  if (typeof days !== "number") return "text-foreground";
  if (days <= 3) return "text-rose-600 dark:text-rose-400";
  if (days <= 7) return "text-amber-600 dark:text-amber-400";
  return "text-foreground";
};

/** One metric in the header strip. */
function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  icon: typeof Flame;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className={cn("mt-1.5 text-xl font-semibold", tone)}>{value}</p>
    </div>
  );
}

/** Compact labelled row used inside learning-path steps. */
function StepFacet({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Target;
}) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <p className="text-sm leading-6 text-muted-foreground">
        <span className="font-medium text-foreground">{label}:</span> {value}
      </p>
    </div>
  );
}

export function RecommendationDetailPanel({
  recommendation,
  repositoryName,
  actions,
  compact = false,
}: RecommendationDetailPanelProps) {
  const context = recommendation.context_snapshot || null;
  const evidence = recommendation.evidence_snapshot || null;
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
  const band = priorityBand(recommendation.priority_score);

  const groupedFindings = (() => {
    const groups = new Map<
      string,
      { title: string; skill: string; severity: Severity; files: string[] }
    >();
    for (const finding of evidence?.keyFindings || []) {
      const existing = groups.get(finding.title);
      if (existing) {
        if (!existing.files.includes(finding.file)) {
          existing.files.push(finding.file);
        }
        if (severityRank[finding.severity] > severityRank[existing.severity]) {
          existing.severity = finding.severity;
        }
      } else {
        groups.set(finding.title, {
          title: finding.title,
          skill: finding.skill,
          severity: finding.severity,
          files: [finding.file],
        });
      }
    }
    return Array.from(groups.values()).slice(0, 6);
  })();

  const showContextSignals =
    Boolean(context?.strengths?.length || context?.commitTopics?.length) &&
    !compact;
  const showMentorship = recommendation.recommendation_type === "mentorship";
  const showDocsReview =
    recommendation.recommendation_type === "docs_review" &&
    Boolean(docsReview?.checklist?.length);

  // Only sections that actually rendered get a jump link.
  const sections = [
    { id: "gaps", label: "Gaps", show: gapCards.length > 0 },
    { id: "evidence", label: "Evidence", show: groupedFindings.length > 0 },
    { id: "mentorship", label: "Mentorship", show: showMentorship },
    { id: "docs-review", label: "Docs review", show: showDocsReview },
    {
      id: "learning-path",
      label: "Learning path",
      show: learningSteps.length > 0,
    },
    { id: "courses", label: "Courses", show: retrievedCoursesByGap.length > 0 },
    {
      id: "success-criteria",
      label: "Success criteria",
      show: Boolean(evidence?.successCriteria?.length),
    },
    { id: "context", label: "Context", show: showContextSignals },
  ].filter((section) => section.show);

  return (
    <div className="space-y-6">
      {/* ------------------------------- Header ------------------------------- */}
      <Card className="overflow-hidden border-border/60 bg-background/90 shadow-sm">
        <span
          aria-hidden="true"
          className={cn("block h-1 w-full", band.rail)}
        />
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 space-y-3">
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
                <Badge
                  variant="outline"
                  className={cn("gap-1", band.badge)}
                  title={`Priority score ${Math.round(
                    recommendation.priority_score || 0,
                  )}`}
                >
                  <Flame className="h-3 w-3" />
                  {band.label}
                </Badge>
              </div>

              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {recommendation.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {recommendation.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" />
                  {repositoryName ? (
                    <span className="font-medium text-foreground">
                      {repositoryName}
                    </span>
                  ) : (
                    <span
                      className="font-mono text-xs text-foreground/80"
                      title={recommendation.repository_id}
                    >
                      {recommendation.repository_id.slice(0, 8)}…
                    </span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">
                    @{recommendation.contributor_login}
                  </span>
                </span>
                {context?.dominantLanguage ? (
                  <span>
                    Language{" "}
                    <span className="font-medium text-foreground">
                      {formatLabel(context.dominantLanguage)}
                    </span>
                  </span>
                ) : null}
                {generatedAt ? (
                  <span>
                    Generated{" "}
                    <span className="font-medium text-foreground">
                      {new Date(generatedAt).toLocaleDateString()}
                    </span>
                  </span>
                ) : null}
              </div>

              {context?.llmProvider ? (
                <p className="text-xs text-muted-foreground/70">
                  Produced by {formatLabel(context.llmProvider)}
                  {context.llmModel ? ` / ${context.llmModel}` : ""}
                </p>
              ) : null}
            </div>

            {actions ? (
              <div className="flex flex-wrap gap-2 xl:shrink-0">{actions}</div>
            ) : null}
          </div>

          <div
            className={cn(
              "mt-6 grid gap-3 sm:grid-cols-2",
              compact ? "xl:grid-cols-4" : "xl:grid-cols-5",
            )}
          >
            <Metric
              label="Priority"
              icon={Flame}
              tone={band.text}
              value={Math.round(recommendation.priority_score || 0)}
            />
            <Metric
              label="Quality"
              icon={GaugeCircle}
              tone={qualityTone(recommendation.quality_score)}
              value={
                typeof recommendation.quality_score === "number"
                  ? `${recommendation.quality_score.toFixed(1)}/10`
                  : "--"
              }
            />
            <Metric
              label="Confidence"
              icon={TrendingUp}
              tone={confidenceTone(recommendation.confidence_score)}
              value={
                typeof recommendation.confidence_score === "number"
                  ? `${Math.round(recommendation.confidence_score * 100)}%`
                  : "--"
              }
            />
            <Metric
              label="Effort"
              icon={Timer}
              value={
                <span className="capitalize">
                  {recommendation.effort_level
                    ? formatLabel(recommendation.effort_level)
                    : "--"}
                </span>
              }
            />
            {!compact ? (
              <Metric
                label="Due window"
                icon={CalendarClock}
                tone={dueTone(recommendation.due_in_days)}
                value={
                  typeof recommendation.due_in_days === "number"
                    ? `${recommendation.due_in_days}d`
                    : "--"
                }
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------- Section nav ---------------------------- */}
      {sections.length > 1 ? (
        <nav
          aria-label="Sections"
          className="sticky top-[4.5rem] z-20 -mx-1 overflow-x-auto rounded-xl border border-border/60 bg-background/85 px-1 py-1.5 backdrop-blur"
        >
          <ul className="flex w-max items-center gap-1 px-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-block whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="space-y-6">
        {showMentorship ? (
          <Card
            id="mentorship"
            className="scroll-mt-32 border-violet-500/25 bg-violet-500/5 shadow-sm"
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserRound className="h-5 w-5" />
                Mentorship
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {recommendation.mentor_snapshot?.name
                  ? `Assigned mentor: ${recommendation.mentor_snapshot.name}${
                      recommendation.mentor_snapshot.email
                        ? ` (${recommendation.mentor_snapshot.email})`
                        : ""
                    }`
                  : "A mentor is attached when the recommendation needs direct guided coaching."}
              </p>
              {scheduledSessionLabel ? (
                <div className="rounded-xl border border-violet-500/20 bg-background/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalendarClock className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    Session scheduled
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {scheduledSessionLabel}
                  </p>
                  {recommendation.mentorship_session_note ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {recommendation.mentorship_session_note}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        {gapCards.length ? (
          <Card
            id="gaps"
            className="scroll-mt-32 border-border/60 bg-background/85 shadow-sm"
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5" />
                Detected gaps
                <Badge variant="secondary" className="ml-1">
                  {gapCards.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {gapCards.map((gap) => (
                <div
                  key={`${recommendation.id}-${gap.key}`}
                  className="rounded-xl border border-border/60 bg-muted/15 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{gap.label}</p>
                      {gap.evidence?.length ? (
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {gap.evidence[0]}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={severityTone[gap.severity]}
                      >
                        {formatLabel(gap.severity)}
                      </Badge>
                      <Badge variant="outline" title="Gap score">
                        {gap.score.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {groupedFindings.length ? (
          <Card
            id="evidence"
            className="scroll-mt-32 border-border/60 bg-background/85 shadow-sm"
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                Evidence from your code
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Findings the analysis used to justify this recommendation.
              </p>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {groupedFindings.map((finding) => (
                <div
                  key={`${recommendation.id}-finding-${finding.title}`}
                  className="rounded-xl border border-border/60 bg-muted/15 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        {finding.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatLabel(finding.skill)} ·{" "}
                        {finding.files.length > 1
                          ? `${finding.files.length} files`
                          : finding.files[0]}
                      </p>
                      {finding.files.length > 1 ? (
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground/70">
                          {finding.files.join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("shrink-0", severityTone[finding.severity])}
                    >
                      {formatLabel(finding.severity)}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {showDocsReview && docsReview?.checklist ? (
          <Card
            id="docs-review"
            className="scroll-mt-32 border-emerald-500/25 bg-emerald-500/5 shadow-sm"
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Docs review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {docsReview.focus_areas?.length ? (
                <div className="rounded-xl border border-emerald-500/20 bg-background/80 p-4">
                  <p className={labelMuted}>Focus areas</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
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
                  className="rounded-xl border border-border/60 bg-background/90 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.file || "Repository-wide"}
                      </p>
                      <h3 className="mt-1 font-semibold text-foreground">
                        {item.title}
                      </h3>
                    </div>
                    {item.skill ? (
                      <Badge variant="secondary" className="shrink-0">
                        {formatLabel(item.skill)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
                    {item.note}
                  </p>
                  {item.success_criteria ? (
                    <div className="mt-3 flex gap-2.5 rounded-lg border border-border/60 bg-muted/15 p-3">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-sm leading-6 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Success signal:
                        </span>{" "}
                        {item.success_criteria}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))}

              {docsReview.resources?.length ? (
                <div className="space-y-2.5 pt-1">
                  <p className={labelMuted}>Resources</p>
                  {docsReview.resources.map((resource) => (
                    <a
                      key={`${recommendation.id}-docs-resource-${resource.url}`}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-border/60 bg-background/90 p-4 transition hover:border-primary/40"
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
                        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </a>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* --------------------------- Learning path --------------------------- */}
        {learningSteps.length ? (
          <Card
            id="learning-path"
            className="scroll-mt-32 border-cyan-500/25 bg-cyan-500/5 shadow-sm"
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5" />
                Learning path
                <Badge variant="secondary" className="ml-1">
                  {learningSteps.length} step
                  {learningSteps.length === 1 ? "" : "s"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recommendation.learning_path?.overview ? (
                <div className="mb-5 rounded-xl border border-cyan-500/20 bg-background/80 p-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {recommendation.learning_path.overview}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {typeof recommendation.learning_path.estimatedTotalHours ===
                    "number" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Timer className="h-3.5 w-3.5" />
                        About{" "}
                        <span className="font-medium text-foreground">
                          {recommendation.learning_path.estimatedTotalHours}h
                        </span>{" "}
                        total
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

              {/* Timeline: a rail connects the numbered steps. */}
              <ol className="relative space-y-4 border-l border-dashed border-cyan-500/30 pl-6">
                {learningSteps.map((step, index) => (
                  <li
                    key={`${recommendation.id}-step-${step.order}`}
                    className="relative"
                  >
                    <span className="absolute -left-[2.1rem] flex h-7 w-7 items-center justify-center rounded-full border-4 border-background bg-cyan-500 text-[11px] font-bold text-white">
                      {step.order ?? index + 1}
                    </span>

                    <div className="rounded-xl border border-border/60 bg-background/90 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="font-semibold text-foreground">
                          {step.title ||
                            formatLabel(step.skill || `step_${step.order}`)}
                        </h3>
                        {typeof step.estimated_hours === "number" ? (
                          <Badge variant="outline" className="shrink-0 gap-1">
                            <Timer className="h-3 w-3" />
                            {step.estimated_hours}h
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-3 space-y-2">
                        {step.goal ? (
                          <StepFacet
                            label="Goal"
                            value={step.goal}
                            icon={Target}
                          />
                        ) : null}
                        {step.why_it_matters ? (
                          <StepFacet
                            label="Why it matters"
                            value={step.why_it_matters}
                            icon={Lightbulb}
                          />
                        ) : null}
                        {step.practice_task ? (
                          <StepFacet
                            label="Practice"
                            value={step.practice_task}
                            icon={ClipboardCheck}
                          />
                        ) : null}
                        {step.success_signal ? (
                          <StepFacet
                            label="Success signal"
                            value={step.success_signal}
                            icon={CheckCircle2}
                          />
                        ) : null}
                      </div>

                      {step.recommended_courses?.length ? (
                        <div className="mt-4 space-y-2">
                          <p className={labelMuted}>Recommended courses</p>
                          {step.recommended_courses.map((course) => (
                            <a
                              key={`${recommendation.id}-${step.order}-${course.courseId}`}
                              href={course.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 transition hover:border-primary/40 hover:bg-muted/25"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">
                                  {course.title}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {course.partner || "Coursera"} ·{" "}
                                  {course.type || "course"}
                                </p>
                              </div>
                              <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ) : null}

        {retrievedCoursesByGap.length ? (
          <Card
            id="courses"
            className="scroll-mt-32 border-border/60 bg-background/85 shadow-sm"
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers3 className="h-5 w-5" />
                Course matches by gap
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {retrievedCoursesByGap.map((match) => (
                <div
                  key={`${recommendation.id}-${match.gapKey}`}
                  className="rounded-xl border border-border/60 bg-muted/15 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">
                      {match.gapLabel}
                    </p>
                    <Badge variant="secondary" className="shrink-0">
                      {match.courses.length} course
                      {match.courses.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="space-y-2.5">
                    {match.courses.slice(0, 3).map((course) => (
                      <a
                        key={`${recommendation.id}-${match.gapKey}-${course.courseId}`}
                        href={course.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl border border-border/60 bg-background/90 p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md motion-reduce:hover:translate-y-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">
                              {course.title}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {course.partner || "Coursera"} ·{" "}
                              {course.type || "course"}
                              {typeof course.rating === "number"
                                ? ` · ${course.rating.toFixed(1)} rating`
                                : ""}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                            View
                            <ArrowUpRight className="h-4 w-4" />
                          </span>
                        </div>
                        {course.description ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {course.description}
                          </p>
                        ) : null}
                        {course.skills?.length ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {course.skills.slice(0, 4).map((skill) => (
                              <Badge
                                key={`${course.courseId}-${skill}`}
                                variant="outline"
                                className="text-xs font-normal"
                              >
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </a>
                    ))}
                    {match.courses.length > 3 ? (
                      <p className="pt-1 text-xs text-muted-foreground">
                        + {match.courses.length - 3} more course
                        {match.courses.length - 3 === 1 ? "" : "s"} matched this
                        gap
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {evidence?.successCriteria?.length ? (
          <Card
            id="success-criteria"
            className="scroll-mt-32 border-border/60 bg-background/85 shadow-sm"
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5" />
                How you'll know it worked
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {evidence.successCriteria.map((criterion, index) => (
                <div
                  key={`${recommendation.id}-criterion-${index}`}
                  className="flex gap-3 rounded-xl border border-border/60 bg-muted/15 p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    {criterion}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {showContextSignals ? (
          <Card
            id="context"
            className="scroll-mt-32 border-border/60 bg-background/85 shadow-sm"
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <GitBranch className="h-5 w-5" />
                Context signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {context?.strengths?.length ? (
                <div>
                  <p className={labelMuted}>Observed strengths</p>
                  <div className="mt-2.5 space-y-2">
                    {context.strengths.map((strength, index) => (
                      <p
                        key={`${recommendation.id}-strength-${index}`}
                        className="rounded-xl border border-border/60 bg-muted/15 p-3 text-sm leading-6 text-muted-foreground"
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
                  <div className="mt-2.5 flex flex-wrap gap-2">
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

        {actions && recommendation.status !== "completed" ? (
          <Card className="border-primary/30 bg-primary/5 shadow-sm">
            <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
              <div>
                <p className="font-medium text-foreground">
                  Done reviewing this recommendation?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mark it complete once you&apos;ve acted on the steps above.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">{actions}</div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
