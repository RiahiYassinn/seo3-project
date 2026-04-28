"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminWorkflowBridge } from "@/components/admin/admin-workflow-bridge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowUpRight,
  Bot,
  CircleAlert,
  CircleCheck,
  Loader2,
  RefreshCw,
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
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [repositoryFilter, setRepositoryFilter] = useState<string>("all");
  const [contributorFilter, setContributorFilter] = useState<string>("");

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

  const profileCount = useMemo(() => Object.keys(profileIdMap).length, [profileIdMap]);

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

  const workflowStepStats = useMemo(
    () => ({
      analysis: {
        value: `${repositories.length}`,
        helper: "repositories available in the workflow",
      },
      profiles: {
        value: `${profileCount}`,
        helper: "analyzed contributor profiles available as evidence",
      },
      recommendations: {
        value: `${stats.total}`,
        helper: `${stats.open} still open for action`,
      },
    }),
    [profileCount, repositories.length, stats.open, stats.total],
  );

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

  const regenerateRecommendation = async (recommendationId: string) => {
    setRegeneratingId(recommendationId);
    setError("");
    try {
      const { data } = await api.post<RecommendationCase>(
        `/recommendations/${recommendationId}/regenerate`,
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
          "Failed to regenerate recommendation",
      );
    } finally {
      setRegeneratingId(null);
    }
  };

  const repositoryFilterOptions = useMemo(() => {
    const uniqueRepositoryIds = Array.from(
      new Set(
        recommendations.map((recommendation) => recommendation.repository_id),
      ),
    );

    return uniqueRepositoryIds
      .map((repositoryId) => ({
        id: repositoryId,
        name: repositoryNameMap[repositoryId] || repositoryId,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [recommendations, repositoryNameMap]);

  const contributorFilterOptions = useMemo(() => {
    return Array.from(
      new Set(
        recommendations.map(
          (recommendation) => recommendation.contributor_login,
        ),
      ),
    ).sort((left, right) => left.localeCompare(right));
  }, [recommendations]);

  const filteredRecommendations = useMemo(() => {
    const contributorQuery = contributorFilter.trim().toLowerCase();

    return recommendations.filter((recommendation) => {
      const matchesStatus =
        statusFilter === "all" || recommendation.status === statusFilter;
      const matchesType =
        typeFilter === "all" ||
        recommendation.recommendation_type === typeFilter;
      const matchesRepository =
        repositoryFilter === "all" ||
        recommendation.repository_id === repositoryFilter;
      const matchesContributor =
        !contributorQuery ||
        recommendation.contributor_login
          .toLowerCase()
          .includes(contributorQuery);

      return (
        matchesStatus && matchesType && matchesRepository && matchesContributor
      );
    });
  }, [
    contributorFilter,
    recommendations,
    repositoryFilter,
    statusFilter,
    typeFilter,
  ]);

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

      <AdminWorkflowBridge
        currentStep="recommendations"
        contextMessage="Recommendations are the action layer of the admin workflow. The analysis and profile pages upstream provide the evidence, and this page turns that context into concrete follow-up decisions."
        stepStats={workflowStepStats}
      />

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

      <Card className="mb-6 border-border/60 bg-background/85 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="completed">Completed</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All types</option>
                <option value="mentorship">Mentorship</option>
                <option value="learning_path">Learning path</option>
                <option value="docs_review">Docs review</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Repository
              </label>
              <select
                value={repositoryFilter}
                onChange={(event) => setRepositoryFilter(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All repositories</option>
                {repositoryFilterOptions.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Contributor
              </label>
              <Input
                value={contributorFilter}
                onChange={(event) => setContributorFilter(event.target.value)}
                placeholder="@username"
                list="recommendation-contributors"
              />
              <datalist id="recommendation-contributors">
                {contributorFilterOptions.map((contributorLogin) => (
                  <option key={contributorLogin} value={contributorLogin} />
                ))}
              </datalist>
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                className="gap-2"
                onClick={() => {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setRepositoryFilter("all");
                  setContributorFilter("");
                }}
              >
                Clear filters
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Showing {filteredRecommendations.length} of {recommendations.length}{" "}
            recommendations.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex min-h-[35vh] items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
        </div>
      ) : filteredRecommendations.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-background/80">
          <CardContent className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-6 w-6" />
            </div>
            <p className="mt-4 text-lg font-semibold">
              No matching recommendations
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Adjust the filters or refresh recommendations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredRecommendations
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
                          variant="outline"
                          className="gap-2"
                          disabled={regeneratingId === recommendation.id}
                          onClick={() =>
                            regenerateRecommendation(recommendation.id)
                          }
                        >
                          {regeneratingId === recommendation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Regenerate
                        </Button>
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
