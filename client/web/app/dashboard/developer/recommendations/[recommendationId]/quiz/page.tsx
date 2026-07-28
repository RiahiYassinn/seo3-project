"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CircleAlert,
  CircleCheck,
  CircleX,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  type QuizState,
  type QuizSubmission,
  quizAPI,
} from "@/lib/quiz";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type RecommendationCase } from "@/app/dashboard/admin/profiles/profile-types";
import { cn } from "@/lib/utils";

export default function RecommendationQuizPage() {
  const router = useRouter();
  const params = useParams();
  const recommendationId = Array.isArray(params.recommendationId)
    ? params.recommendationId[0]
    : params.recommendationId;
  const { user, hasHydrated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [recommendation, setRecommendation] =
    useState<RecommendationCase | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizSubmission | null>(null);

  const loadData = useCallback(async () => {
    if (!recommendationId) return;

    try {
      const [quiz, recommendations] = await Promise.all([
        quizAPI.get(recommendationId),
        api.get<RecommendationCase[]>("/recommendations/me"),
      ]);

      setQuizState(quiz);
      setRecommendation(
        (recommendations.data || []).find(
          (item) => item.id === recommendationId,
        ) || null,
      );
      setError("");
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to load the quiz",
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

  const questions = quizState?.quiz?.questions || [];
  const answeredCount = questions.filter(
    (question) => typeof answers[question.id] === "number",
  ).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const generateQuiz = async (regenerate = false) => {
    if (!recommendationId) return;

    setGenerating(true);
    setError("");
    setResult(null);
    setAnswers({});

    try {
      const quiz = await quizAPI.generate(recommendationId, regenerate);
      setQuizState(quiz);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to build your quiz",
      );
    } finally {
      setGenerating(false);
    }
  };

  const submitQuiz = async () => {
    if (!recommendationId || !allAnswered) return;

    setSubmitting(true);
    setError("");

    try {
      const submission = await quizAPI.submit(
        recommendationId,
        questions.map((question) => ({
          questionId: question.id,
          selectedIndex: answers[question.id],
        })),
      );

      setResult(submission);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Refresh attempt history and the recommendation's new status.
      loadData();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to submit your answers",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const retake = () => {
    setResult(null);
    setAnswers({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const planHref = `/dashboard/developer/recommendations/${recommendationId}/plan`;
  const alreadyPassed = Boolean(quizState?.passed) && !result;

  const heading = useMemo(() => {
    if (result?.passed) return "You passed";
    if (result) return "Not quite yet";
    if (alreadyPassed) return "Already validated";
    return "Validate what you learned";
  }, [alreadyPassed, result]);

  if (!hasHydrated || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-40 animate-pulse rounded-2xl bg-muted" />
          <div className="mt-6 space-y-4">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-44 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.08),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_30%)]">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm" className="-ml-3 gap-2">
            <Link href={planHref}>
              <ArrowLeft className="h-4 w-4" />
              Back to your plan
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
        <Card
          className={cn(
            "overflow-hidden border-border/60 bg-background/90 shadow-sm",
            result?.passed && "border-emerald-500/40",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "block h-1 w-full",
              result?.passed
                ? "bg-emerald-500"
                : result
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-primary to-cyan-500",
            )}
          />
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  Knowledge check
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
                  {heading}
                </h1>
                {recommendation ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {recommendation.title}
                  </p>
                ) : null}
              </div>

              {result ? (
                <div className="text-right">
                  <p
                    className={cn(
                      "text-4xl font-bold leading-none",
                      result.passed
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {result.score_percent}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {result.correct_count}/{result.total} correct · {result.pass_percent}% to pass
                  </p>
                </div>
              ) : quizState?.quiz ? (
                <Badge variant="outline" className="gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  {questions.length} questions · {quizState.pass_percent}% to
                  pass
                </Badge>
              ) : null}
            </div>

            {/* Outcome messaging */}
            {result?.passed ? (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="text-sm">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                    Recommendation marked as completed
                  </p>
                  <p className="mt-1 leading-6 text-emerald-700/90 dark:text-emerald-300/90">
                    It no longer shows as open work in your feed. Review the
                    answers below whenever you want.
                  </p>
                </div>
              </div>
            ) : result ? (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    You need {result.pass_percent}% to pass
                  </p>
                  <p className="mt-1 leading-6 text-amber-700/90 dark:text-amber-300/90">
                    Every answer is explained below. Review the material in your
                    plan, then retake it — there is no attempt limit.
                  </p>
                </div>
              </div>
            ) : alreadyPassed ? (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="text-sm">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                    You already passed this quiz
                  </p>
                  <p className="mt-1 leading-6 text-emerald-700/90 dark:text-emerald-300/90">
                    Scored {quizState?.last_attempt?.score_percent}% on attempt{" "}
                    {quizState?.attempt_count}. You can generate a fresh set of
                    questions if you want more practice.
                  </p>
                </div>
              </div>
            ) : quizState?.last_attempt ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Last attempt: {quizState.last_attempt.score_percent}% (
                {quizState.last_attempt.correct_count}/
                {quizState.last_attempt.total}) · {quizState.attempt_count}{" "}
                attempt{quizState.attempt_count === 1 ? "" : "s"} so far.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* ------------------------------ No quiz yet ------------------------------ */}
        {!quizState?.quiz ? (
          <Card className="mt-6 border-dashed border-border/60 bg-background/70">
            <CardContent className="p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">
                Build your knowledge check
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                The questions are written from your own detected gaps and the
                steps in your plan — not a generic question bank.
              </p>
              <Button
                className="mt-6 gap-2"
                size="lg"
                onClick={() => generateQuiz(false)}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating ? "Building your quiz…" : "Generate my quiz"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ------------------------------ Questions ------------------------------ */}
            <ol className="mt-6 space-y-4">
              {questions.map((question, index) => {
                const questionResult = result?.results.find(
                  (item) => item.question_id === question.id,
                );
                const selected = answers[question.id];

                return (
                  <li key={question.id}>
                    <Card
                      className={cn(
                        "border-border/60 bg-background/90 shadow-sm",
                        questionResult?.correct && "border-emerald-500/35",
                        questionResult &&
                          !questionResult.correct &&
                          "border-rose-500/35",
                      )}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium leading-6">
                              {question.prompt}
                            </p>

                            <div className="mt-4 space-y-2">
                              {question.options.map((option, optionIndex) => {
                                const isSelected = selected === optionIndex;
                                const isCorrectAnswer =
                                  questionResult?.correct_index === optionIndex;
                                const isWrongPick =
                                  questionResult &&
                                  questionResult.selected_index ===
                                    optionIndex &&
                                  !questionResult.correct;

                                return (
                                  <label
                                    key={`${question.id}-${optionIndex}`}
                                    className={cn(
                                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors",
                                      result
                                        ? "cursor-default"
                                        : "hover:border-primary/40 hover:bg-muted/40",
                                      isCorrectAnswer
                                        ? "border-emerald-500/40 bg-emerald-500/10"
                                        : isWrongPick
                                          ? "border-rose-500/40 bg-rose-500/10"
                                          : isSelected && !result
                                            ? "border-primary/45 bg-primary/[0.07]"
                                            : "border-border/60 bg-muted/15",
                                    )}
                                  >
                                    <input
                                      type="radio"
                                      name={question.id}
                                      value={optionIndex}
                                      checked={isSelected}
                                      disabled={Boolean(result)}
                                      onChange={() =>
                                        setAnswers((current) => ({
                                          ...current,
                                          [question.id]: optionIndex,
                                        }))
                                      }
                                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                                    />
                                    <span className="flex-1 leading-6">
                                      {option}
                                    </span>
                                    {isCorrectAnswer ? (
                                      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    ) : isWrongPick ? (
                                      <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                                    ) : null}
                                  </label>
                                );
                              })}
                            </div>

                            {questionResult?.explanation ? (
                              <p className="mt-3 rounded-lg border border-border/60 bg-muted/25 p-3 text-sm leading-6 text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  Why:
                                </span>{" "}
                                {questionResult.explanation}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ol>

            {/* ------------------------------- Actions ------------------------------- */}
            <Card className="mt-6 border-border/60 bg-primary/[0.04] shadow-sm">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                {result ? (
                  <>
                    <div>
                      <p className="font-semibold">
                        {result.passed
                          ? "Nicely done"
                          : "Review the material and try again"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {result.passed
                          ? "Your recommendation is closed out."
                          : `You answered ${result.correct_count} of ${result.total} correctly.`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:shrink-0">
                      <Button asChild variant="outline" className="gap-2">
                        <Link href={planHref}>
                          <BookOpen className="h-4 w-4" />
                          Review the plan
                        </Link>
                      </Button>
                      {result.passed ? (
                        <Button asChild className="gap-2">
                          <Link href="/dashboard/developer/recommendations">
                            Back to recommendations
                          </Link>
                        </Button>
                      ) : (
                        <Button onClick={retake} className="gap-2">
                          <RefreshCw className="h-4 w-4" />
                          Retake the quiz
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-semibold">
                        {answeredCount}/{questions.length} answered
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Passing at {quizState.pass_percent}% marks this
                        recommendation completed.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:shrink-0">
                      <Button
                        variant="ghost"
                        className="gap-2 text-muted-foreground"
                        onClick={() => generateQuiz(true)}
                        disabled={generating || submitting}
                        title="Replace these questions with a new set"
                      >
                        {generating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        New questions
                      </Button>
                      <Button
                        size="lg"
                        className="gap-2"
                        onClick={submitQuiz}
                        disabled={!allAnswered || submitting}
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CircleCheck className="h-4 w-4" />
                        )}
                        Submit answers
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
