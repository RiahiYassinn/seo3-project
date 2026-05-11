"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { RecommendationDetailPanel } from "@/components/recommendations/recommendation-detail-panel";
import { useAuthStore } from "@/lib/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CircleCheck, Loader, Loader2, Sparkles } from "lucide-react";
import { type RecommendationCase } from "@/app/dashboard/admin/profiles/profile-types";

interface GitHubIntegration {
  id: string;
  github_username: string;
  connected_at: string;
}

interface RepositoryRecord {
  id: string;
  repo_name: string;
}

export default function DeveloperRecommendationsPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [integration, setIntegration] = useState<GitHubIntegration | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationCase[]>([]);
  const [repositories, setRepositories] = useState<Record<string, string>>({});
  const [ackLoadingId, setAckLoadingId] = useState<string | null>(null);

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

      const nextRecommendations = (recommendationResponse.data || []).slice().sort(
        (left, right) => right.priority_score - left.priority_score,
      );

      setRepositories(repoNameMap);
      setRecommendations(nextRecommendations);
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

  const acknowledgeRecommendation = async (recommendationId: string) => {
    setAckLoadingId(recommendationId);
    setError("");

    try {
      const { data } = await api.post<RecommendationCase>(
        `/recommendations/${recommendationId}/acknowledge`,
      );

      if (data) {
        setRecommendations((current) =>
          current.map((recommendation) =>
            recommendation.id === recommendationId
              ? { ...recommendation, ...data }
              : recommendation,
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
      setAckLoadingId(null);
    }
  };

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

  const stats = useMemo(() => {
    return {
      total: recommendations.length,
      open: recommendations.filter((item) => item.status === "open").length,
      assigned: recommendations.filter((item) => item.status === "assigned")
        .length,
      completed: recommendations.filter((item) => item.status === "completed")
        .length,
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.08),transparent_22%),linear-gradient(180deg,#f8fafc,#eef2f7)]">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
              Linked Account Recommendations
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Personal Coaching Queue
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              These recommendations are generated from your linked GitHub activity
              and now include evidence, confidence, and measurable success
              criteria.
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
              <Card className="border-border/60 bg-background/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-background/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.open}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-background/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Assigned</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.assigned}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-background/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {stats.completed}
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
              <div className="space-y-6">
                {recommendations.map((recommendation) => (
                  <RecommendationDetailPanel
                    key={recommendation.id}
                    recommendation={recommendation}
                    repositoryName={repositories[recommendation.repository_id]}
                    compact
                    actions={
                      <Button
                        type="button"
                        className="gap-2"
                        variant={
                          recommendation.status === "completed"
                            ? "outline"
                            : "default"
                        }
                        disabled={
                          recommendation.status === "completed" ||
                          ackLoadingId === recommendation.id
                        }
                        onClick={() =>
                          acknowledgeRecommendation(recommendation.id)
                        }
                      >
                        {ackLoadingId === recommendation.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : recommendation.status === "completed" ? (
                          <CircleCheck className="h-4 w-4" />
                        ) : null}
                        {recommendation.status === "completed"
                          ? "Completed"
                          : "Mark completed"}
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
