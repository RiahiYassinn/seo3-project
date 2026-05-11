"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminWorkflowBridge } from "@/components/admin/admin-workflow-bridge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildAdminWorkflowHref,
  readAdminWorkflowContext,
} from "@/lib/admin-workflow";
import {
  ArrowUpRight,
  BookOpen,
  Bot,
  CircleAlert,
  CircleCheck,
  ExternalLink,
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
  const searchParams = useSearchParams();
  const navigationContext = useMemo(
    () => readAdminWorkflowContext(searchParams),
    [searchParams],
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendationCase[]>([]);
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [ackLoadingId, setAckLoadingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState(
    navigationContext.recommendationId || "",
  );
  const [repositoryFilter, setRepositoryFilter] = useState<string>(
    navigationContext.repoId || "all",
  );
  const [contributorFilter, setContributorFilter] = useState<string>(
    navigationContext.contributorLogin || "",
  );

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const [recommendationResponse, repositoryResponse] = await Promise.all([
        api.get<RecommendationCase[]>("/recommendations/me"),
        api.get<RepositoryRecord[]>("/github/repositories"),
      ]);

      const nextRecommendations = recommendationResponse.data || [];
      setRecommendations(nextRecommendations);
      setRepositories(repositoryResponse.data || []);
      setError("");
      setSelectedRecommendationId((current) => {
        if (
          current &&
          nextRecommendations.some((recommendation) => recommendation.id === current)
        ) {
          return current;
        }
        return nextRecommendations[0]?.id || "";
      });
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

  const profileCount = useMemo(
    () => Object.keys(profileIdMap).length,
    [profileIdMap],
  );

  const workflowStepStats = useMemo(
    () => ({
      analysis: `${repositories.length}`,
      profiles: `${profileCount}`,
      recommendations: `${recommendations.length}`,
    }),
    [profileCount, recommendations.length, repositories.length],
  );

  const filteredRecommendations = useMemo(() => {
    const contributorQuery = contributorFilter.trim().toLowerCase();

    return recommendations
      .filter((recommendation) => {
        const matchesRepository =
          repositoryFilter === "all" ||
          recommendation.repository_id === repositoryFilter;
        const matchesContributor =
          !contributorQuery ||
          recommendation.contributor_login.toLowerCase().includes(contributorQuery);

        return matchesRepository && matchesContributor;
      })
      .slice()
      .sort((left, right) => right.priority_score - left.priority_score);
  }, [contributorFilter, recommendations, repositoryFilter]);

  const selectedRecommendation = useMemo(() => {
    if (filteredRecommendations.length === 0) {
      return null;
    }

    return (
      filteredRecommendations.find(
        (recommendation) => recommendation.id === selectedRecommendationId,
      ) || filteredRecommendations[0]
    );
  }, [filteredRecommendations, selectedRecommendationId]);

  useEffect(() => {
    if (!selectedRecommendation && filteredRecommendations.length > 0) {
      setSelectedRecommendationId(filteredRecommendations[0].id);
      return;
    }

    if (
      selectedRecommendationId &&
      !filteredRecommendations.some(
        (recommendation) => recommendation.id === selectedRecommendationId,
      )
    ) {
      setSelectedRecommendationId(filteredRecommendations[0]?.id || "");
    }
  }, [filteredRecommendations, selectedRecommendation, selectedRecommendationId]);

  const workflowContext = useMemo(() => {
    const selectedProfileId =
      selectedRecommendation &&
      profileIdMap[
        recommendationKey(
          selectedRecommendation.repository_id,
          selectedRecommendation.contributor_login,
        )
      ];

    return {
      repoId: selectedRecommendation?.repository_id || navigationContext.repoId,
      repoName:
        (selectedRecommendation &&
          repositoryNameMap[selectedRecommendation.repository_id]) ||
        undefined,
      contributorLogin:
        selectedRecommendation?.contributor_login ||
        contributorFilter.trim() ||
        undefined,
      profileId: selectedProfileId || undefined,
      recommendationId: selectedRecommendation?.id || undefined,
    };
  }, [
    contributorFilter,
    navigationContext.repoId,
    profileIdMap,
    repositoryNameMap,
    selectedRecommendation,
  ]);

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
      new Set(recommendations.map((recommendation) => recommendation.repository_id)),
    );

    return uniqueRepositoryIds
      .map((repositoryId) => ({
        id: repositoryId,
        name: repositoryNameMap[repositoryId] || repositoryId,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [recommendations, repositoryNameMap]);

  const retrievedCourses =
    selectedRecommendation?.evidence_snapshot?.retrievedCoursesByGap || [];
  const learningSteps = selectedRecommendation?.learning_path?.steps || [];

  return (
    <AdminShell
      title="Recommendations"
      subtitle="Only the queue, the recommendation itself, and the suggested courses."
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
          Refresh
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
        context={workflowContext}
        stepStats={workflowStepStats}
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row">
        <select
          value={repositoryFilter}
          onChange={(event) => setRepositoryFilter(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm lg:w-72"
        >
          <option value="all">All repositories</option>
          {repositoryFilterOptions.map((repository) => (
            <option key={repository.id} value={repository.id}>
              {repository.name}
            </option>
          ))}
        </select>
        <Input
          value={contributorFilter}
          onChange={(event) => setContributorFilter(event.target.value)}
          placeholder="Filter by contributor"
          className="lg:w-72"
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setRepositoryFilter("all");
            setContributorFilter("");
          }}
        >
          Reset
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="border-border/60 bg-background/90 shadow-sm xl:sticky xl:top-6 xl:h-[calc(100vh-12rem)]">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">Queue</CardTitle>
              <Badge variant="secondary">{filteredRecommendations.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-[20rem] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRecommendations.length === 0 ? (
              <div className="p-8 text-center">
                <Bot className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No recommendations found.
                </p>
              </div>
            ) : (
              <div className="max-h-[calc(100vh-18rem)] overflow-y-auto">
                {filteredRecommendations.map((recommendation) => {
                  const selected = selectedRecommendation?.id === recommendation.id;

                  return (
                    <button
                      key={recommendation.id}
                      type="button"
                      onClick={() => setSelectedRecommendationId(recommendation.id)}
                      className={`w-full border-b border-border/40 px-4 py-4 text-left transition last:border-b-0 ${
                        selected ? "bg-cyan-500/8" : "hover:bg-muted/30"
                      }`}
                    >
                      <p className="line-clamp-2 text-sm font-semibold text-foreground">
                        {recommendation.title}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        @{recommendation.contributor_login}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
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
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {selectedRecommendation ? (
            <>
              <Card className="border-border/60 bg-background/92 shadow-sm">
                <CardHeader className="border-b border-border/50">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className={
                            recommendationTypeTone[
                              selectedRecommendation.recommendation_type
                            ]
                          }
                        >
                          {formatLabel(selectedRecommendation.recommendation_type)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={recommendationStatusTone(
                            selectedRecommendation.status,
                          )}
                        >
                          {formatLabel(selectedRecommendation.status)}
                        </Badge>
                      </div>
                      <div>
                        <CardTitle className="text-2xl leading-tight">
                          {selectedRecommendation.title}
                        </CardTitle>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                          {selectedRecommendation.description}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {repositoryNameMap[selectedRecommendation.repository_id] ||
                          selectedRecommendation.repository_id}{" "}
                        • @{selectedRecommendation.contributor_login}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {profileIdMap[
                        recommendationKey(
                          selectedRecommendation.repository_id,
                          selectedRecommendation.contributor_login,
                        )
                      ] ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={() =>
                            router.push(
                              buildAdminWorkflowHref(
                                `/dashboard/admin/profiles/${encodeURIComponent(
                                  profileIdMap[
                                    recommendationKey(
                                      selectedRecommendation.repository_id,
                                      selectedRecommendation.contributor_login,
                                    )
                                  ],
                                )}`,
                                workflowContext,
                              ),
                            )
                          }
                        >
                          Open profile
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        disabled={regeneratingId === selectedRecommendation.id}
                        onClick={() =>
                          regenerateRecommendation(selectedRecommendation.id)
                        }
                      >
                        {regeneratingId === selectedRecommendation.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Regenerate
                      </Button>
                      <Button
                        type="button"
                        className="gap-2"
                        variant={
                          selectedRecommendation.status === "completed"
                            ? "outline"
                            : "default"
                        }
                        disabled={
                          selectedRecommendation.status === "completed" ||
                          ackLoadingId === selectedRecommendation.id
                        }
                        onClick={() =>
                          acknowledgeRecommendation(selectedRecommendation.id)
                        }
                      >
                        {ackLoadingId === selectedRecommendation.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : selectedRecommendation.status === "completed" ? (
                          <CircleCheck className="h-4 w-4" />
                        ) : null}
                        {selectedRecommendation.status === "completed"
                          ? "Completed"
                          : "Mark completed"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {selectedRecommendation.recommendation_type === "learning_path" &&
                learningSteps.length ? (
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-cyan-600" />
                      <p className="text-sm font-medium text-foreground">
                        Learning path
                      </p>
                    </div>
                    <div className="space-y-4">
                      {learningSteps.map((step) => (
                        <div
                          key={`${selectedRecommendation.id}-step-${step.order}`}
                          className="rounded-2xl border border-border/60 bg-muted/10 p-4"
                        >
                          <p className="text-sm font-semibold text-foreground">
                            Step {step.order}
                            {step.title ? ` • ${step.title}` : ""}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {step.goal}
                          </p>
                          {step.practice_task ? (
                            <p className="mt-2 text-sm text-foreground/85">
                              {step.practice_task}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                ) : null}
              </Card>

              {selectedRecommendation.recommendation_type === "learning_path" ? (
                <Card className="border-border/60 bg-background/92 shadow-sm">
                  <CardHeader className="border-b border-border/50">
                    <CardTitle className="text-lg">
                      Suggested courses from the vector database
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5 p-6">
                    {retrievedCourses.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No retrieved courses were attached to this recommendation.
                      </p>
                    ) : (
                      retrievedCourses.map((match) => (
                        <div
                          key={`${selectedRecommendation.id}-${match.gapKey}`}
                          className="space-y-3"
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {match.gapLabel}
                          </p>
                          <div className="space-y-3">
                            {match.courses.map((course) => (
                              <a
                                key={`${match.gapKey}-${course.courseId}`}
                                href={course.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-2xl border border-border/60 bg-muted/10 p-4 transition hover:border-primary/40"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-medium text-foreground">
                                      {course.title}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      {course.partner || "Coursera"} •{" "}
                                      {course.type || "course"}
                                    </p>
                                  </div>
                                  <ExternalLink className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                </div>
                                {course.description ? (
                                  <p className="mt-3 text-sm text-muted-foreground">
                                    {course.description}
                                  </p>
                                ) : null}
                                <p className="mt-3 text-sm font-medium text-primary">
                                  Open Coursera course
                                </p>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : (
            <Card className="border-dashed border-border/60 bg-background/85">
              <CardContent className="p-12 text-center">
                <Bot className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-4 text-lg font-semibold text-foreground">
                  Select a recommendation
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose an item from the queue to see the recommendation and,
                  for learning paths, the retrieved courses only.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
