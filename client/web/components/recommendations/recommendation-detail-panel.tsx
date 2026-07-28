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
  ScanSearch,
  Target,
  Timer,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  /** Utility actions shown in the report header (regenerate, mark complete…). */
  actions?: ReactNode;
  /** Role-specific call to action closing the report. */
  primaryAction?: ReactNode;
  /** One line of context shown beside the primary action. */
  primaryActionNote?: string;
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

const listPhrase = (values: string[], max = 3) => {
  const items = values.filter(Boolean).slice(0, max);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
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

/** Compact labelled row used inside plan steps. */
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

/** Numbered heading for a section of the report. */
function SectionHeading({
  index,
  title,
  description,
  icon: Icon,
  aside,
}: {
  index: number;
  title: string;
  description?: string;
  icon: typeof Target;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground/70">
          {String(index).padStart(2, "0")}
        </span>
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold leading-tight">
            <Icon className="h-4.5 w-4.5 text-muted-foreground" />
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {aside}
    </div>
  );
}

export function RecommendationDetailPanel({
  recommendation,
  repositoryName,
  actions,
  primaryAction,
  primaryActionNote,
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
  const repoLabel =
    repositoryName || context?.repoName || recommendation.repository_id;

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

  /* ------------------------- Why this recommendation ------------------------- */

  const allFindings = evidence?.keyFindings || [];
  const severeFindings = allFindings.filter(
    (finding) => finding.severity === "critical" || finding.severity === "high",
  ).length;
  const touchedFiles = new Set(allFindings.map((finding) => finding.file)).size;
  const topGaps = [...gapCards].sort(
    (left, right) => severityRank[right.severity] - severityRank[left.severity],
  );
  const leadGap = topGaps[0] || null;
  const repeated = context?.repeatedWeaknesses || [];
  const trendDelta = context?.qualityTrendDelta ?? null;

  const analysedSentence = [
    `We reviewed @${recommendation.contributor_login}'s recent work in ${repoLabel}`,
    context?.dominantLanguage
      ? `, mostly ${formatLabel(context.dominantLanguage)}`
      : "",
    context?.commitTopics?.length
      ? `, across ${listPhrase(context.commitTopics.map(formatLabel))}`
      : "",
    ".",
  ].join("");

  const detectedSentence = allFindings.length
    ? `That review surfaced ${allFindings.length} finding${
        allFindings.length === 1 ? "" : "s"
      }${touchedFiles ? ` in ${touchedFiles} file${touchedFiles === 1 ? "" : "s"}` : ""}${
        severeFindings
          ? `, ${severeFindings} of them high or critical severity`
          : ""
      }.`
    : gapCards.length
      ? `The analysis flagged ${gapCards.length} skill gap${
          gapCards.length === 1 ? "" : "s"
        } in this contributor's profile.`
      : "The analysis compared this contributor's profile against the team baseline.";

  const patternSentence = leadGap
    ? `${leadGap.label} stood out as the ${formatLabel(leadGap.severity)}-severity gap${
        repeated.length
          ? `, and ${listPhrase(repeated.map(formatLabel), 2)} kept recurring across runs`
          : ""
      }.`
    : repeated.length
      ? `${listPhrase(repeated.map(formatLabel), 2)} kept recurring across analysis runs.`
      : "";

  const conclusionSentence =
    recommendation.recommendation_type === "learning_path"
      ? `So the plan below targets that gap directly — ${
          learningSteps.length
            ? `${learningSteps.length} step${learningSteps.length === 1 ? "" : "s"}`
            : "a focused set of steps"
        }${
          typeof recommendation.learning_path?.estimatedTotalHours === "number"
            ? `, about ${recommendation.learning_path.estimatedTotalHours} hours of work`
            : ""
        }.`
      : recommendation.recommendation_type === "mentorship"
        ? "The pattern is the kind that review comments rarely fix on their own, so this recommendation asks for direct mentoring rather than self-study."
        : "The fastest correction here is documentation, so this recommendation is a short docs review rather than a full learning path.";

  const rationale = [
    analysedSentence,
    detectedSentence,
    patternSentence,
    conclusionSentence,
  ]
    .filter(Boolean)
    .join(" ");

  const evidenceChain = [
    {
      label: "Analyzed",
      value: context?.commitTopics?.length
        ? `${context.commitTopics.length} commit topics`
        : repoLabel,
      icon: ScanSearch,
    },
    {
      label: "Detected",
      value: gapCards.length
        ? `${gapCards.length} skill gap${gapCards.length === 1 ? "" : "s"}`
        : `${allFindings.length} findings`,
      icon: Target,
    },
    {
      label: "Recommended",
      value: formatLabel(recommendation.recommendation_type),
      icon: Lightbulb,
    },
  ];

  const showContextSignals =
    Boolean(context?.strengths?.length || context?.commitTopics?.length) &&
    !compact;
  const showMentorship = recommendation.recommendation_type === "mentorship";
  const showDocsReview =
    recommendation.recommendation_type === "docs_review" &&
    Boolean(docsReview?.checklist?.length);
  const showPlan = showMentorship || showDocsReview || learningSteps.length > 0;

  const planTitle = showMentorship
    ? "Mentorship plan"
    : showDocsReview
      ? "Docs review plan"
      : "Learning path";

  // Only sections that actually render get a number and a jump link.
  const sections = [
    { id: "why", label: "Why this", show: true },
    { id: "gaps", label: "Gaps", show: gapCards.length > 0 },
    { id: "evidence", label: "Evidence", show: groupedFindings.length > 0 },
    { id: "plan", label: planTitle, show: showPlan },
    { id: "courses", label: "Courses", show: retrievedCoursesByGap.length > 0 },
    {
      id: "success-criteria",
      label: "Success criteria",
      show: Boolean(evidence?.successCriteria?.length),
    },
    { id: "context", label: "Context", show: showContextSignals },
  ].filter((section) => section.show);

  const sectionNumber = (id: string) =>
    sections.findIndex((section) => section.id === id) + 1;

  return (
    <Card className="overflow-hidden border-border/60 bg-background/90 shadow-sm">
      <span aria-hidden="true" className={cn("block h-1 w-full", band.rail)} />

      {/* ============================ Report header ============================ */}
      <header className="p-6 md:p-8">
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
              <p className={labelMuted}>Recommendation report</p>
              <h2 className="mt-1.5 text-2xl font-semibold tracking-tight md:text-3xl">
                {recommendation.title}
              </h2>
              <p className="mt-2.5 max-w-3xl text-sm leading-6 text-muted-foreground">
                {recommendation.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{repoLabel}</span>
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
      </header>

      {/* ============================= Section nav ============================= */}
      {sections.length > 2 ? (
        <nav
          aria-label="Report sections"
          className="sticky top-[4.5rem] z-20 overflow-x-auto border-y border-border/60 bg-background/90 px-4 py-2 backdrop-blur md:px-8"
        >
          <ul className="flex w-max items-center gap-1">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <span className="font-mono tabular-nums opacity-60">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {/* =============================== Report =============================== */}
      <div className="divide-y divide-border/60">
        {/* ------------------------ Why this recommendation ------------------------ */}
        <section id="why" className="scroll-mt-32 p-6 md:p-8">
          <SectionHeading
            index={sectionNumber("why")}
            icon={Lightbulb}
            title="Why this recommendation"
            description="What the analysis saw, and how it reached this conclusion."
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <p className="text-[0.95rem] leading-7 text-muted-foreground">
              {rationale}
            </p>

            <div className="space-y-2">
              {evidenceChain.map((step, index) => (
                <div
                  key={step.label}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/15 px-3.5 py-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border/60">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {step.label}
                    </p>
                    <p className="truncate text-sm font-medium capitalize">
                      {step.value}
                    </p>
                  </div>
                  {index < evidenceChain.length - 1 ? null : null}
                </div>
              ))}
            </div>
          </div>

          {typeof trendDelta === "number" && trendDelta !== 0 ? (
            <p
              className={cn(
                "mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                trendDelta > 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}
            >
              <TrendingUp className="h-4 w-4" />
              Quality score has moved {trendDelta > 0 ? "up" : "down"} by{" "}
              {Math.abs(trendDelta).toFixed(1)} since the previous analysis.
            </p>
          ) : null}
        </section>

        {/* ------------------------------- Gaps ------------------------------- */}
        {gapCards.length ? (
          <section id="gaps" className="scroll-mt-32 p-6 md:p-8">
            <SectionHeading
              index={sectionNumber("gaps")}
              icon={Target}
              title="Skill gaps detected"
              description="Ranked by severity, each backed by evidence from the analysis."
              aside={
                <Badge variant="secondary">{gapCards.length} detected</Badge>
              }
            />
            <div className="space-y-2.5">
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
            </div>
          </section>
        ) : null}

        {/* ----------------------------- Evidence ----------------------------- */}
        {groupedFindings.length ? (
          <section id="evidence" className="scroll-mt-32 p-6 md:p-8">
            <SectionHeading
              index={sectionNumber("evidence")}
              icon={TrendingUp}
              title="Evidence from the code"
              description="The findings that justified this recommendation, with the files they came from."
            />
            <div className="space-y-2.5">
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
            </div>
          </section>
        ) : null}

        {/* ------------------------------- Plan ------------------------------- */}
        {showPlan ? (
          <section id="plan" className="scroll-mt-32 p-6 md:p-8">
            <SectionHeading
              index={sectionNumber("plan")}
              icon={showMentorship ? UserRound : showDocsReview ? FileText : BookOpen}
              title={planTitle}
              description={
                showMentorship
                  ? "How the mentoring engagement is set up."
                  : showDocsReview
                    ? "Short, targeted documentation work."
                    : "Ordered steps that close the gaps above."
              }
              aside={
                learningSteps.length ? (
                  <Badge variant="secondary">
                    {learningSteps.length} step
                    {learningSteps.length === 1 ? "" : "s"}
                    {typeof recommendation.learning_path
                      ?.estimatedTotalHours === "number"
                      ? ` · ~${recommendation.learning_path.estimatedTotalHours}h`
                      : ""}
                  </Badge>
                ) : null
              }
            />

            {/* Mentorship */}
            {showMentorship ? (
              <div className="space-y-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  {recommendation.mentor_snapshot?.name
                    ? `Assigned mentor: ${recommendation.mentor_snapshot.name}${
                        recommendation.mentor_snapshot.email
                          ? ` (${recommendation.mentor_snapshot.email})`
                          : ""
                      }`
                    : "No mentor is attached yet. A tech lead claims this case from the mentor queue."}
                </p>
                {scheduledSessionLabel ? (
                  <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.07] p-4">
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
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                    No session scheduled yet.
                  </div>
                )}
              </div>
            ) : null}

            {/* Docs review */}
            {showDocsReview && docsReview?.checklist ? (
              <div className="space-y-3">
                {docsReview.focus_areas?.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={labelMuted}>Focus</span>
                    {docsReview.focus_areas.map((area) => (
                      <Badge
                        key={`${recommendation.id}-docs-${area}`}
                        variant="outline"
                      >
                        {area}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {docsReview.checklist.map((item, index) => (
                  <div
                    key={`${recommendation.id}-docs-review-${index}`}
                    className="rounded-xl border border-border/60 bg-muted/15 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">
                          {item.file || "Repository-wide"}
                        </p>
                        <h4 className="mt-1 font-semibold">{item.title}</h4>
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
                      <div className="mt-3 flex gap-2.5 rounded-lg border border-border/60 bg-background p-3">
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
                  <div className="space-y-2 pt-1">
                    <p className={labelMuted}>Resources</p>
                    {docsReview.resources.map((resource) => (
                      <a
                        key={`${recommendation.id}-docs-resource-${resource.url}`}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/15 p-4 transition-colors hover:border-primary/40"
                      >
                        <div>
                          <p className="font-medium">{resource.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {resource.type || "resource"}
                          </p>
                        </div>
                        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Learning path timeline */}
            {learningSteps.length ? (
              <div>
                {recommendation.learning_path?.overview ? (
                  <p className="mb-5 rounded-xl border border-border/60 bg-muted/15 p-4 text-sm leading-6 text-muted-foreground">
                    {recommendation.learning_path.overview}
                  </p>
                ) : null}

                <ol className="relative space-y-4 border-l border-dashed border-primary/30 pl-6">
                  {learningSteps.map((step, index) => (
                    <li
                      key={`${recommendation.id}-step-${step.order}`}
                      className="relative"
                    >
                      <span className="absolute -left-[2.1rem] flex h-7 w-7 items-center justify-center rounded-full border-4 border-background bg-primary text-[11px] font-bold text-primary-foreground">
                        {step.order ?? index + 1}
                      </span>

                      <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h4 className="font-semibold">
                            {step.title ||
                              formatLabel(step.skill || `step_${step.order}`)}
                          </h4>
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
                                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background p-3 transition-colors hover:border-primary/40"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">
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
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ------------------------------ Courses ------------------------------ */}
        {retrievedCoursesByGap.length ? (
          <section id="courses" className="scroll-mt-32 p-6 md:p-8">
            <SectionHeading
              index={sectionNumber("courses")}
              icon={Layers3}
              title="Course matches by gap"
              description="Retrieved from the course library for each detected gap."
            />
            <div className="space-y-4">
              {retrievedCoursesByGap.map((match) => (
                <div key={`${recommendation.id}-${match.gapKey}`}>
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <p className="font-medium">{match.gapLabel}</p>
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
                        className="block rounded-xl border border-border/60 bg-muted/15 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md motion-reduce:hover:translate-y-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{course.title}</p>
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
                      </a>
                    ))}
                    {match.courses.length > 3 ? (
                      <p className="text-xs text-muted-foreground">
                        + {match.courses.length - 3} more course
                        {match.courses.length - 3 === 1 ? "" : "s"} matched this
                        gap
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* -------------------------- Success criteria -------------------------- */}
        {evidence?.successCriteria?.length ? (
          <section id="success-criteria" className="scroll-mt-32 p-6 md:p-8">
            <SectionHeading
              index={sectionNumber("success-criteria")}
              icon={CheckCircle2}
              title="How you'll know it worked"
              description="What should be true once this recommendation is done."
            />
            <div className="space-y-2.5">
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
            </div>
          </section>
        ) : null}

        {/* ------------------------------ Context ------------------------------ */}
        {showContextSignals ? (
          <section id="context" className="scroll-mt-32 p-6 md:p-8">
            <SectionHeading
              index={sectionNumber("context")}
              icon={GitBranch}
              title="Context signals"
              description="Strengths and recent activity picked up during analysis."
            />
            <div className="space-y-4">
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
            </div>
          </section>
        ) : null}
      </div>

      {/* ============================= Action zone ============================= */}
      {primaryAction ? (
        <footer className="border-t border-border/60 bg-primary/[0.04] p-6 md:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold">
                {recommendation.status === "completed"
                  ? "This recommendation is complete"
                  : "Ready to act on this?"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {primaryActionNote ||
                  "Everything above came from this contributor's own commits and reviews."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              {primaryAction}
            </div>
          </div>
        </footer>
      ) : null}
    </Card>
  );
}
