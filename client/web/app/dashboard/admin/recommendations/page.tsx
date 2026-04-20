"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpRight,
  Bot,
  CircleAlert,
  CircleCheck,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  type RecommendationCase,
  type RepositoryRecord,
  formatLabel,
  recommendationKey,
  recommendationStatusTone,
  recommendationTypeTone,
} from "../profiles/profile-types";

export default function AdminRecommendationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendationCase[]>(
    [],
  );
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [ackLoadingId, setAckLoadingId] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const [recommendationResponse, repositoryResponse] = await Promise.all([
        api.get<RecommendationCase[]>("/recommendations/me"),
        api.get<RepositoryRecord[]>("/github/repositories"),
      ]);

      setRecommendations(recommendationResponse.data || []);
      setRepositories(repositoryResponse.data || []);
      setError("");
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to load recommendation workflow",
      );
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const repositoryNameMap = useMemo(() => {
    return Object.fromEntries(
      repositories.map((repository) => [repository.id, repository.repo_name]),
    ) as Record<string, string>;
  }, [repositories]);

  const profileIdMap = useMemo(() => {
    const entries: Array<[string, string]> = [];

    for (const repository of repositories) {
      const contributorProfiles =
        repository.analysis_metadata?.contributorProfiles || {};

      for (const profile of Object.values(contributorProfiles)) {
        entries.push([
          recommendationKey(repository.id, profile.contributorLogin),
          profile.profileId,
        ]);
      }
    }

    return Object.fromEntries(entries) as Record<string, string>;
  }, [repositories]);

  const stats = useMemo(() => {
    return {
      total: recommendations.length,
      mentorship: recommendations.filter(
        (item) => item.recommendation_type === "mentorship",
      ).length,
      open: recommendations.filter((item) => item.status === "open").length,
      completed: recommendations.filter((item) => item.status === "completed")
        .length,
    };
  }, [recommendations]);

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

  return (
    <AdminShell
      title="Recommendation Workflow"
      subtitle="Every generated contributor profile gets a recommendation decision: mentorship, learning path, or docs review."
      actions={
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Refresh recommendations
        </Button>
      }
    >
      {error ? (
        <Alert className="mb-6 border-destructive/40 bg-destructive/10">
          <CircleAlert className="h-4 w-4" />
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Total recommendations
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "--" : stats.total}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Mentorship</p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "--" : stats.mentorship}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Open</p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "--" : stats.open}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "--" : stats.completed}
            </p>
          </CardContent>
        </Card>
      </section>

      {loading ? (
        <div className="flex min-h-[35vh] items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
        </div>
      ) : recommendations.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-background/80">
          <CardContent className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-6 w-6" />
            </div>
            <p className="mt-4 text-lg font-semibold">No recommendations yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Run contributor analysis from GitHub admin workflow to generate
              developer profiles and recommendations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {recommendations
            .slice()
            .sort((left, right) => right.priority_score - left.priority_score)
            .map((recommendation) => {
              const recommendationProfileId =
                profileIdMap[
                  recommendationKey(
                    recommendation.repository_id,
                    recommendation.contributor_login,
                  )
                ];

              return (
                <Card
                  key={recommendation.id}
                  className="border-border/60 bg-background/85 shadow-sm"
                >
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">
                          {recommendation.title}
                        </CardTitle>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Repo:{" "}
                          {repositoryNameMap[recommendation.repository_id] ||
                            recommendation.repository_id}
                          {" · "}
                          Contributor: @{recommendation.contributor_login}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className={
                            recommendationTypeTone[
                              recommendation.recommendation_type
                            ]
                          }
                        >
                          {formatLabel(recommendation.recommendation_type)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={recommendationStatusTone(
                            recommendation.status,
                          )}
                        >
                          {formatLabel(recommendation.status)}
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
                        <p className="mt-1 text-xl font-semibold">
                          {recommendation.priority_score}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Quality score
                        </p>
                        <p className="mt-1 text-xl font-semibold">
                          {typeof recommendation.quality_score === "number"
                            ? `${recommendation.quality_score.toFixed(2)}/10`
                            : "--"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Generated{" "}
                        {new Date(recommendation.created_at).toLocaleString()}
                      </p>
                      <div className="flex gap-2">
                        {recommendationProfileId ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() =>
                              router.push(
                                `/dashboard/admin/profiles/${encodeURIComponent(recommendationProfileId)}`,
                              )
                            }
                          >
                            Profile
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}
    </AdminShell>
  );
}
