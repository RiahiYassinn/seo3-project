"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpRight,
  BookOpen,
  CircleAlert,
  Loader,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

type RecommendationType = "mentorship" | "learning_path" | "docs_review";

interface GitHubIntegration {
  id: string;
  github_username: string;
  connected_at: string;
}

interface RecommendationCase {
  id: string;
  repository_id: string;
  contributor_login: string;
  recommendation_type: RecommendationType;
  status: "open" | "assigned" | "completed" | "dismissed";
  priority_score: number;
  quality_score: number | null;
  title: string;
  description: string;
  mentor_snapshot?: {
    id?: string;
    name?: string;
    username?: string;
    email?: string;
  } | null;
  learning_path?: {
    durationWeeks?: number;
    steps?: Array<{
      order: number;
      skill: string;
      goal: string;
      resources?: Array<{ title: string; url: string; type: string }>;
    }>;
  } | null;
  docs_review?: {
    checklist?: Array<{
      title: string;
      skill: string;
      file: string;
      note: string;
    }>;
    resources?: Array<{ title: string; url: string; type: string }>;
  } | null;
  weakness_snapshot?: {
    topWeaknesses?: Array<{ skill: string; score: number }>;
  } | null;
  created_at: string;
}

interface RepositoryRecord {
  id: string;
  repo_name: string;
}

const typeBadgeTone: Record<RecommendationType, string> = {
  mentorship: "bg-violet-500/10 text-violet-700 border-violet-500/30",
  learning_path: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",
  docs_review: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

const statusTone: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  assigned: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  dismissed: "bg-muted text-muted-foreground",
};

const toLabel = (value: string) => value.replace(/_/g, " ");

export default function DeveloperRecommendationsPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [integration, setIntegration] = useState<GitHubIntegration | null>(
    null,
  );
  const [recommendations, setRecommendations] = useState<RecommendationCase[]>(
    [],
  );
  const [repositories, setRepositories] = useState<Record<string, string>>({});

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const integrationResponse = await api.get<GitHubIntegration>(
        "/github/integration",
      );
      setIntegration(integrationResponse.data);

      const [recommendationResponse, repositoryResponse] = await Promise.all([
        api.get<RecommendationCase[]>("/recommendations/me"),
        api.get<RepositoryRecord[]>("/github/repositories"),
      ]);

      const repoNameMap: Record<string, string> = {};
      for (const repository of repositoryResponse.data || []) {
        repoNameMap[repository.id] = repository.repo_name;
      }

      setRepositories(repoNameMap);
      setRecommendations(recommendationResponse.data || []);
      setError("");
    } catch (requestError: any) {
      if (requestError?.response?.status === 404) {
        setIntegration(null);
        setRecommendations([]);
        setRepositories({});
        setError("");
      } else {
        setError(
          requestError?.response?.data?.message ||
            requestError?.message ||
            "Failed to load recommendations",
        );
      }
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, []);

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

  const recommendationStats = useMemo(() => {
    return {
      total: recommendations.length,
      mentorship: recommendations.filter(
        (recommendation) => recommendation.recommendation_type === "mentorship",
      ).length,
      learningPath: recommendations.filter(
        (recommendation) =>
          recommendation.recommendation_type === "learning_path",
      ).length,
      docsReview: recommendations.filter(
        (recommendation) =>
          recommendation.recommendation_type === "docs_review",
      ).length,
    };
  }, [recommendations]);

  if (!hasHydrated || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex h-[calc(100vh-64px)] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-cyan-500/5 to-violet-500/10">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
              Linked Account Recommendations
            </p>
            <h1 className="mt-2 text-4xl font-bold">Recommendation Center</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Read recommendations generated for your linked GitHub account.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="gap-2"
          >
            {refreshing ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Refreshing
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Refresh Recommendations
              </>
            )}
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

        {!integration ? (
          <Card className="border-dashed border-border/60 bg-background/80">
            <CardContent className="p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                Link your GitHub account first
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Recommendations are only available for a linked GitHub account.
              </p>
              <Button
                className="mt-5"
                onClick={() => router.push("/dashboard/developer/github")}
              >
                Go to GitHub Integration
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border-border/60 bg-background/80">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {recommendationStats.total}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-background/80">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Mentorship</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {recommendationStats.mentorship}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-background/80">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">
                    Learning Paths
                  </p>
                  <p className="mt-2 text-3xl font-semibold">
                    {recommendationStats.learningPath}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-background/80">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Docs Review</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {recommendationStats.docsReview}
                  </p>
                </CardContent>
              </Card>
            </section>

            {recommendations.length === 0 ? (
              <Card className="border-dashed border-border/60 bg-background/70">
                <CardContent className="p-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold">
                    No recommendations yet
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Recommendations will appear here once analysis is available
                    for your linked account.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {recommendations.map((recommendation) => {
                  const repositoryName =
                    repositories[recommendation.repository_id] ||
                    recommendation.repository_id;

                  return (
                    <Card
                      key={recommendation.id}
                      className="border-border/60 bg-background/90 shadow-sm"
                    >
                      <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-xl">
                              {recommendation.title}
                            </CardTitle>
                            <p className="mt-2 text-sm text-muted-foreground">
                              Repo: {repositoryName} · Contributor: @
                              {recommendation.contributor_login}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant="outline"
                              className={
                                typeBadgeTone[
                                  recommendation.recommendation_type
                                ]
                              }
                            >
                              {toLabel(recommendation.recommendation_type)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                statusTone[recommendation.status] ||
                                statusTone.open
                              }
                            >
                              {toLabel(recommendation.status)}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          {recommendation.description}
                        </p>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              Priority
                            </p>
                            <p className="mt-1 text-2xl font-semibold">
                              {recommendation.priority_score}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              Quality score
                            </p>
                            <p className="mt-1 text-2xl font-semibold">
                              {typeof recommendation.quality_score === "number"
                                ? `${recommendation.quality_score.toFixed(2)}/10`
                                : "--"}
                            </p>
                          </div>
                        </div>

                        {recommendation.recommendation_type === "mentorship" ? (
                          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
                            <p className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                              <UserRound className="h-4 w-4" />
                              Mentor assignment
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {recommendation.mentor_snapshot?.name
                                ? `${recommendation.mentor_snapshot.name} (${recommendation.mentor_snapshot.email || "No email"})`
                                : "No mentor assigned yet. A tech lead will claim this recommendation soon."}
                            </p>
                          </div>
                        ) : null}

                        {recommendation.recommendation_type ===
                          "learning_path" &&
                        recommendation.learning_path?.steps?.length ? (
                          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
                            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
                              <BookOpen className="h-4 w-4" />
                              Suggested learning path (
                              {recommendation.learning_path.durationWeeks ||
                                0}{" "}
                              weeks)
                            </p>
                            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                              {recommendation.learning_path.steps
                                .slice(0, 3)
                                .map((step) => (
                                  <div
                                    key={`${recommendation.id}-${step.order}`}
                                    className="rounded-xl border border-border/50 bg-background p-3"
                                  >
                                    <p className="font-medium text-foreground">
                                      Step {step.order}: {toLabel(step.skill)}
                                    </p>
                                    <p className="mt-1">{step.goal}</p>
                                    {step.resources?.[0]?.url ? (
                                      <a
                                        href={step.resources[0].url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
                                      >
                                        {step.resources[0].title}
                                        <ArrowUpRight className="h-3 w-3" />
                                      </a>
                                    ) : null}
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : null}

                        {recommendation.recommendation_type === "docs_review" &&
                        recommendation.docs_review?.checklist?.length ? (
                          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                              <ShieldCheck className="h-4 w-4" />
                              Docs review checklist
                            </p>
                            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                              {recommendation.docs_review.checklist
                                .slice(0, 4)
                                .map((item, index) => (
                                  <li
                                    key={`${recommendation.id}-${index}`}
                                    className="rounded-xl border border-border/50 bg-background p-3"
                                  >
                                    <p className="font-medium text-foreground">
                                      {item.title}
                                    </p>
                                    <p className="mt-1">{item.note}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                      {toLabel(item.skill)}
                                    </p>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : null}

                        {recommendation.weakness_snapshot?.topWeaknesses
                          ?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {recommendation.weakness_snapshot.topWeaknesses.map(
                              (weakness) => (
                                <Badge
                                  key={`${recommendation.id}-${weakness.skill}`}
                                  variant="secondary"
                                >
                                  {toLabel(weakness.skill)} ·{" "}
                                  {weakness.score.toFixed(2)}
                                </Badge>
                              ),
                            )}
                          </div>
                        ) : null}

                        <p className="text-xs text-muted-foreground">
                          Created{" "}
                          {new Date(recommendation.created_at).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
