"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Lightbulb,
  Loader2,
  MapPin,
  GraduationCap,
  Sparkles,
  Target,
  Timer,
  Trophy,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type RecommendationCase,
  formatLabel,
} from "@/app/dashboard/admin/profiles/profile-types";
import { type QuizState, quizAPI } from "@/lib/quiz";
import { cn } from "@/lib/utils";

interface RepositoryRecord {
  id: string;
  repo_name: string;
}

const progressStorageKey = (recommendationId: string) =>
  `devlab:plan-progress:${recommendationId}`;

const readProgress = (recommendationId: string): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(
      progressStorageKey(recommendationId),
    );
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function DeveloperRecommendationPlanPage() {
  const router = useRouter();
  const params = useParams();
  const recommendationId = Array.isArray(params.recommendationId)
    ? params.recommendationId[0]
    : params.recommendationId;
  const { user, hasHydrated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendationCase[]>(
    [],
  );
  const [repositories, setRepositories] = useState<Record<string, string>>({});
  const [ackLoading, setAckLoading] = useState(false);
  const [doneKeys, setDoneKeys] = useState<string[]>([]);
  const [quizState, setQuizState] = useState<QuizState | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [recommendationResponse, repositoryResponse] = await Promise.all([
        api.get<RecommendationCase[]>("/recommendations/me"),
        api.get<RepositoryRecord[]>("/github/repositories"),
      ]);

      const repoNameMap: Record<string, string> = {};
      for (const repository of repositoryResponse.data || []) {
        repoNameMap[repository.id] = repository.repo_name;
      }

      setRecommendations(recommendationResponse.data || []);
      setRepositories(repoNameMap);
      setError("");

      if (recommendationId) {
        // Quiz state is supplementary — a failure here must not blank the plan.
        try {
          setQuizState(await quizAPI.get(recommendationId));
        } catch {
          setQuizState(null);
        }
      }
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to load your action plan",
      );
    } finally {
      setLoading(false);
    }
  }, [recommendationId]);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "developer") {
      router.replace("/dashboard");
      return;
    }

    loadData();
  }, [hasHydrated, loadData, router, user]);

  useEffect(() => {
    if (recommendationId) {
      setDoneKeys(readProgress(recommendationId));
    }
  }, [recommendationId]);

  const recommendation = useMemo(
    () => recommendations.find((item) => item.id === recommendationId) || null,
    [recommendationId, recommendations],
  );

  const steps = useMemo(() => {
    if (!recommendation) return [];

    if (recommendation.recommendation_type === "docs_review") {
      return (recommendation.docs_review?.checklist || []).map(
        (item, index) => ({
          key: `docs-${index}`,
          order: index + 1,
          title: item.title,
          goal: item.note,
          whyItMatters: undefined as string | undefined,
          practice: item.file ? `Update ${item.file}` : undefined,
          successSignal: item.success_criteria,
          hours: undefined as number | undefined,
          courses: [] as NonNullable<
            NonNullable<RecommendationCase["learning_path"]>["steps"]
          >[number]["recommended_courses"],
        }),
      );
    }

    return (recommendation.learning_path?.steps || []).map((step, index) => ({
      key: `step-${step.order ?? index + 1}`,
      order: step.order ?? index + 1,
      title: step.title || formatLabel(step.skill || `step_${index + 1}`),
      goal: step.goal,
      whyItMatters: step.why_it_matters,
      practice: step.practice_task,
      successSignal: step.success_signal,
      hours: step.estimated_hours,
      courses: step.recommended_courses,
    }));
  }, [recommendation]);

  const doneSet = useMemo(() => new Set(doneKeys), [doneKeys]);
  const completedCount = steps.filter((step) => doneSet.has(step.key)).length;
  const progress = steps.length ? (completedCount / steps.length) * 100 : 0;
  const nextStepKey = steps.find((step) => !doneSet.has(step.key))?.key;
  const remainingHours = steps
    .filter((step) => !doneSet.has(step.key))
    .reduce((sum, step) => sum + (step.hours || 0), 0);

  const toggleStep = (key: string) => {
    if (!recommendationId) return;

    setDoneKeys((current) => {
      const next = current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key];

      try {
        window.localStorage.setItem(
          progressStorageKey(recommendationId),
          JSON.stringify(next),
        );
      } catch {
        // A full or blocked storage quota should not break the checklist.
      }

      return next;
    });
  };

  const acknowledgeRecommendation = async () => {
    if (!recommendation) return;

    setAckLoading(true);
    setError("");

    try {
      const { data } = await api.post<RecommendationCase>(
        `/recommendations/${recommendation.id}/acknowledge`,
      );

      if (data) {
        setRecommendations((current) =>
          current.map((item) =>
            item.id === recommendation.id ? { ...item, ...data } : item,
          ),
        );
      }
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to update recommendation status",
      );
    } finally {
      setAckLoading(false);
    }
  };

  if (!hasHydrated || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-32 animate-pulse rounded-2xl bg-muted" />
          <div className="mt-6 space-y-4">
            {[0, 1, 2].map((step) => (
              <div
                key={step}
                className="h-44 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!recommendation) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Card className="border-dashed border-border/60 bg-background/80">
            <CardContent className="p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <CircleAlert className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-xl font-semibold">Plan not available</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {error ||
                  "This recommendation may have been removed, or it does not belong to your linked GitHub account."}
              </p>
              <Button asChild className="mt-5">
                <Link href="/dashboard/developer/recommendations">
                  Back to recommendations
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const isMentorship = recommendation.recommendation_type === "mentorship";
  const isCompleted = recommendation.status === "completed";
  const quizPassed = Boolean(quizState?.passed);
  const isOnsiteSession = recommendation.mentorship_session_mode === "onsite";
  const repoName =
    repositories[recommendation.repository_id] ||
    recommendation.context_snapshot?.repoName ||
    recommendation.repository_id;
  const scheduledSession = recommendation.mentorship_session_scheduled_at
    ? new Date(recommendation.mentorship_session_scheduled_at)
    : null;

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.08),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_30%)]">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm" className="-ml-3 gap-2">
            <Link
              href={`/dashboard/developer/recommendations/${recommendation.id}`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to the full report
            </Link>
          </Button>
        </div>

        {error ? (
          <Alert className="mb-6 border-destructive/40 bg-destructive/10">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* ------------------------------- Header ------------------------------- */}
        <Card className="overflow-hidden border-border/60 bg-background/90 shadow-sm">
          <span
            aria-hidden="true"
            className="block h-1 w-full bg-gradient-to-r from-primary to-cyan-500"
          />
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {isMentorship ? (
                    <UserRound className="h-3.5 w-3.5" />
                  ) : recommendation.recommendation_type === "docs_review" ? (
                    <FileText className="h-3.5 w-3.5" />
                  ) : (
                    <BookOpen className="h-3.5 w-3.5" />
                  )}
                  Your action plan
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
                  {recommendation.title}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {repoName} · @{recommendation.contributor_login}
                </p>
              </div>
              {isCompleted ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  <CircleCheck className="h-3.5 w-3.5" />
                  Completed
                </Badge>
              ) : null}
            </div>

            {steps.length ? (
              <div className="mt-6">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-2xl font-semibold text-foreground">
                      {completedCount}
                    </span>
                    <span className="text-lg font-semibold text-foreground">
                      /{steps.length}
                    </span>{" "}
                    steps done
                  </p>
                  {remainingHours > 0 ? (
                    <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" />~{remainingHours}h
                      remaining
                    </p>
                  ) : null}
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Step progress is kept on this device.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* -------------------------------- Steps -------------------------------- */}
        {isMentorship ? (
          <Card className="mt-6 border-violet-500/25 bg-violet-500/[0.05] shadow-sm">
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5" />
                Mentoring
              </h2>

              {recommendation.mentor_snapshot?.name ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Your mentor is{" "}
                  <span className="font-medium text-foreground">
                    {recommendation.mentor_snapshot.name}
                  </span>
                  {recommendation.mentor_snapshot.email
                    ? ` (${recommendation.mentor_snapshot.email})`
                    : ""}
                  .
                </p>
              ) : (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  No mentor is attached yet. Pick one from your recommendations
                  list to get started.
                </p>
              )}

              {scheduledSession ? (
                <div className="mt-4 rounded-xl border border-violet-500/25 bg-background/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-2 text-sm font-medium">
                      <CalendarClock className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      Session scheduled
                    </p>
                    <Badge variant="outline" className="gap-1.5">
                      {isOnsiteSession ? (
                        <MapPin className="h-3 w-3" />
                      ) : (
                        <Video className="h-3 w-3" />
                      )}
                      {isOnsiteSession ? "On-site" : "Remote"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {scheduledSession.toLocaleString([], {
                      dateStyle: "full",
                      timeStyle: "short",
                    })}
                  </p>
                  {isOnsiteSession &&
                  recommendation.mentorship_session_location ? (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {recommendation.mentorship_session_location}
                    </p>
                  ) : null}
                  {recommendation.mentorship_session_note ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {recommendation.mentorship_session_note}
                    </p>
                  ) : null}
                  {!isOnsiteSession ? (
                    recommendation.mentorship_session_join_url ? (
                      <Button asChild className="mt-3 gap-2">
                        <a
                          href={recommendation.mentorship_session_join_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Video className="h-4 w-4" />
                          Join Teams meeting
                        </a>
                      </Button>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Your mentor will share the meeting link before the
                        session.
                      </p>
                    )
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                  Your mentor will schedule a session — you&apos;ll get a
                  notification when they do.
                </div>
              )}

              {!recommendation.mentor_id ? (
                <Button asChild className="mt-5 gap-2">
                  <Link href="/dashboard/developer/recommendations">
                    Find a mentor
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : steps.length ? (
          <ol className="mt-6 space-y-4">
            {steps.map((step) => {
              const done = doneSet.has(step.key);
              const isNext = step.key === nextStepKey;

              return (
                <li key={step.key}>
                  <Card
                    className={cn(
                      "border-border/60 bg-background/90 shadow-sm transition-colors",
                      done && "opacity-70",
                      isNext && "border-primary/45 ring-1 ring-primary/15",
                    )}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3.5">
                        <Checkbox
                          checked={done}
                          onCheckedChange={() => toggleStep(step.key)}
                          className="mt-1"
                          aria-label={`Mark "${step.title}" as done`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Step {step.order}
                              </p>
                              <h3
                                className={cn(
                                  "mt-1 text-lg font-semibold leading-tight",
                                  done && "line-through",
                                )}
                              >
                                {step.title}
                              </h3>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {isNext && !done ? (
                                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                                  Up next
                                </Badge>
                              ) : null}
                              {typeof step.hours === "number" ? (
                                <Badge variant="outline" className="gap-1">
                                  <Timer className="h-3 w-3" />
                                  {step.hours}h
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3 space-y-2">
                            {step.goal ? (
                              <p className="flex gap-2.5 text-sm leading-6 text-muted-foreground">
                                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>
                                  <span className="font-medium text-foreground">
                                    Goal:
                                  </span>{" "}
                                  {step.goal}
                                </span>
                              </p>
                            ) : null}
                            {step.whyItMatters ? (
                              <p className="flex gap-2.5 text-sm leading-6 text-muted-foreground">
                                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>
                                  <span className="font-medium text-foreground">
                                    Why it matters:
                                  </span>{" "}
                                  {step.whyItMatters}
                                </span>
                              </p>
                            ) : null}
                            {step.practice ? (
                              <p className="flex gap-2.5 text-sm leading-6 text-muted-foreground">
                                <ClipboardCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>
                                  <span className="font-medium text-foreground">
                                    Practice:
                                  </span>{" "}
                                  {step.practice}
                                </span>
                              </p>
                            ) : null}
                            {step.successSignal ? (
                              <p className="flex gap-2.5 text-sm leading-6 text-muted-foreground">
                                <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>
                                  <span className="font-medium text-foreground">
                                    Done when:
                                  </span>{" "}
                                  {step.successSignal}
                                </span>
                              </p>
                            ) : null}
                          </div>

                          {step.courses?.length ? (
                            <div className="mt-4 space-y-2">
                              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                Recommended courses
                              </p>
                              {step.courses.map((course) => (
                                <a
                                  key={`${step.key}-${course.courseId}`}
                                  href={course.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/15 p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
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
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>
        ) : (
          <Card className="mt-6 border-dashed border-border/60 bg-background/70">
            <CardContent className="p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">No steps generated</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                This recommendation has no step-by-step plan attached. The full
                report still explains the gaps behind it.
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link
                  href={`/dashboard/developer/recommendations/${recommendation.id}`}
                >
                  Read the report
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ------------------------------- Wrap up ------------------------------- */}
        {steps.length || isMentorship ? (
          <div className="mt-6 space-y-4">
            {/* Quiz is the preferred way to close a self-serve plan. */}
            {!isMentorship ? (
              <Card
                className={cn(
                  "overflow-hidden shadow-sm",
                  quizPassed
                    ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                    : "border-primary/25 bg-primary/[0.04]",
                )}
              >
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        quizPassed
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {quizPassed ? (
                        <Trophy className="h-5 w-5" />
                      ) : (
                        <GraduationCap className="h-5 w-5" />
                      )}
                    </span>
                    <div>
                      <p className="font-semibold">
                        {quizPassed
                          ? "Knowledge check passed"
                          : quizState?.attempt_count
                            ? "Retake the knowledge check"
                            : "Validate what you learned"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {quizPassed
                          ? `You scored ${quizState?.last_attempt?.score_percent}% and this recommendation was closed automatically.`
                          : quizState?.last_attempt
                            ? `Last attempt scored ${quizState.last_attempt.score_percent}% — ${quizState.pass_percent}% passes and completes this recommendation.`
                            : "A short quiz built from your own gaps and steps. Pass it and this recommendation completes itself."}
                      </p>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="lg"
                    variant={quizPassed ? "outline" : "default"}
                    className="gap-2 sm:shrink-0"
                  >
                    <Link
                      href={`/dashboard/developer/recommendations/${recommendation.id}/quiz`}
                    >
                      <GraduationCap className="h-4 w-4" />
                      {quizPassed
                        ? "Review answers"
                        : quizState?.attempt_count
                          ? "Retake quiz"
                          : "Take the quiz"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-border/60 bg-background/85 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {isCompleted
                      ? "This recommendation is complete"
                      : completedCount === steps.length && steps.length > 0
                        ? "All steps done — close it out"
                        : "Finished everything?"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isCompleted
                      ? "It stays in your history and no longer appears as open work."
                      : isMentorship
                        ? "Marking it complete updates your recommendations feed."
                        : "You can close it manually instead of taking the quiz."}
                  </p>
                </div>
                <Button
                  type="button"
                  size={isMentorship ? "lg" : "default"}
                  className="gap-2 sm:shrink-0"
                  variant={isCompleted || !isMentorship ? "outline" : "default"}
                  disabled={isCompleted || ackLoading}
                  onClick={acknowledgeRecommendation}
                >
                  {ackLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CircleCheck className="h-4 w-4" />
                  )}
                  {isCompleted ? "Completed" : "Mark as completed"}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}
