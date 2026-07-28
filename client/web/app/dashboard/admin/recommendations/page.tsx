"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminWorkflowBridge } from "@/components/admin/admin-workflow-bridge";
import { RecommendationDetailPanel } from "@/components/recommendations/recommendation-detail-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildAdminWorkflowHref,
  readAdminWorkflowContext,
} from "@/lib/admin-workflow";
import {
  ArrowUpRight,
  Bot,
  CircleAlert,
  CircleCheck,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  type RecommendationCase,
  type RepositoryRecord,
  formatLabel,
  priorityBand,
  recommendationKey,
  recommendationStatusTone,
  recommendationTypeTone,
} from "../profiles/profile-types";
import { cn } from "@/lib/utils";

const hasAnalysisActivity = (repository: RepositoryRecord) => {
  const contributorProfiles = Object.values(
    repository.analysis_metadata?.contributorProfiles || {},
  );

  return (
    contributorProfiles.length > 0 ||
    Boolean((repository as any).last_analyzed_at) ||
    ["pending", "in_progress", "completed", "failed"].includes(
      String((repository as any).analysis_status || ""),
    )
  );
};

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
  const [recommendations, setRecommendations] = useState<RecommendationCase[]>(
    [],
  );
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
    navigationContext.contributorLogin || "all",
  );
  const [search, setSearch] = useState("");

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
          nextRecommendations.some(
            (recommendation) => recommendation.id === current,
          )
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

  const analyzedRepositories = useMemo(
    () => repositories.filter((repository) => hasAnalysisActivity(repository)),
    [repositories],
  );

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
    const term = search.trim().toLowerCase();

    return recommendations
      .filter((recommendation) => {
        const matchesRepository =
          repositoryFilter === "all" ||
          recommendation.repository_id === repositoryFilter;
        const matchesContributor =
          contributorFilter === "all" ||
          recommendation.contributor_login === contributorFilter;

        if (!matchesRepository || !matchesContributor) {
          return false;
        }

        if (!term) return true;

        return [
          recommendation.title,
          recommendation.description,
          recommendation.contributor_login,
          repositoryNameMap[recommendation.repository_id],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .slice()
      .sort((left, right) => right.priority_score - left.priority_score);
  }, [
    contributorFilter,
    recommendations,
    repositoryFilter,
    repositoryNameMap,
    search,
  ]);

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
  }, [
    filteredRecommendations,
    selectedRecommendation,
    selectedRecommendationId,
  ]);

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
        (contributorFilter !== "all" ? contributorFilter : undefined) ||
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
    const options = analyzedRepositories.map((repository) => ({
      id: repository.id,
      name: repository.repo_name,
    }));

    if (
      repositoryFilter !== "all" &&
      !options.some((repository) => repository.id === repositoryFilter)
    ) {
      const selectedRepository = repositories.find(
        (repository) => repository.id === repositoryFilter,
      );
      if (selectedRepository) {
        options.push({
          id: selectedRepository.id,
          name: selectedRepository.repo_name,
        });
      }
    }

    return options.sort((left, right) => left.name.localeCompare(right.name));
  }, [analyzedRepositories, repositories, repositoryFilter]);

  const contributorFilterOptions = useMemo(() => {
    const relevantRecommendations = recommendations.filter((recommendation) =>
      repositoryFilter === "all"
        ? true
        : recommendation.repository_id === repositoryFilter,
    );

    return Array.from(
      new Set(
        relevantRecommendations.map((recommendation) =>
          String(recommendation.contributor_login || "").trim(),
        ),
      ),
    )
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  }, [recommendations, repositoryFilter]);

  useEffect(() => {
    if (loading || repositoryFilter === "all") {
      return;
    }

    if (
      !repositories.some((repository) => repository.id === repositoryFilter)
    ) {
      setRepositoryFilter("all");
    }
  }, [loading, repositories, repositoryFilter]);

  useEffect(() => {
    if (loading || contributorFilter === "all") {
      return;
    }

    if (!contributorFilterOptions.includes(contributorFilter)) {
      setContributorFilter("all");
    }
  }, [contributorFilter, contributorFilterOptions, loading]);

  const filtersActive =
    repositoryFilter !== "all" ||
    contributorFilter !== "all" ||
    search.trim() !== "";

  const resetFilters = () => {
    setRepositoryFilter("all");
    setContributorFilter("all");
    setSearch("");
  };

  const selectedProfileId = selectedRecommendation
    ? profileIdMap[
        recommendationKey(
          selectedRecommendation.repository_id,
          selectedRecommendation.contributor_login,
        )
      ]
    : undefined;

  return (
    <AdminShell
      title="Recommendations"
      subtitle="Review what the engine produced for each contributor, then complete or regenerate it."
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
          <AlertDescription className="flex items-center justify-between gap-3 text-destructive">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss"
              className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      <AdminWorkflowBridge
        currentStep="recommendations"
        context={workflowContext}
        stepStats={workflowStepStats}
      />

      {/* ------------------------------ Toolbar ------------------------------ */}
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search recommendations"
            className="pl-9"
            aria-label="Search recommendations"
          />
        </div>

        <Select value={repositoryFilter} onValueChange={setRepositoryFilter}>
          <SelectTrigger className="sm:w-56" aria-label="Filter by repository">
            <SelectValue placeholder="All repositories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All repositories</SelectItem>
            {repositoryFilterOptions.map((repository) => (
              <SelectItem key={repository.id} value={repository.id}>
                {repository.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={contributorFilter} onValueChange={setContributorFilter}>
          <SelectTrigger className="sm:w-52" aria-label="Filter by contributor">
            <SelectValue placeholder="All contributors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All contributors</SelectItem>
            {contributorFilterOptions.map((contributorLogin) => (
              <SelectItem key={contributorLogin} value={contributorLogin}>
                @{contributorLogin}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtersActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)] xl:items-start">
        {/* ------------------------------- Queue ------------------------------- */}
        <Card className="border-border/60 bg-background/90 shadow-sm xl:sticky xl:top-6">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Queue</CardTitle>
              <Badge variant="secondary">
                {filteredRecommendations.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3].map((row) => (
                  <div
                    key={row}
                    className="h-20 animate-pulse rounded-xl bg-muted"
                  />
                ))}
              </div>
            ) : filteredRecommendations.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  {filtersActive ? (
                    <Inbox className="h-5 w-5" />
                  ) : (
                    <Bot className="h-5 w-5" />
                  )}
                </div>
                <p className="mt-3 text-sm font-medium">
                  {filtersActive ? "Nothing matches" : "No recommendations"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {filtersActive
                    ? "Clear the filters to see everything."
                    : "Generate one from a contributor profile."}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[calc(100vh-20rem)]">
                <div className="p-2">
                  {filteredRecommendations.map((recommendation) => {
                    const selected =
                      selectedRecommendation?.id === recommendation.id;
                    const band = priorityBand(recommendation.priority_score);

                    return (
                      <button
                        key={recommendation.id}
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        onClick={() =>
                          setSelectedRecommendationId(recommendation.id)
                        }
                        className={cn(
                          "relative mb-1 w-full overflow-hidden rounded-xl px-3.5 py-3 pl-4 text-left transition-colors",
                          selected
                            ? "bg-primary/[0.07] ring-1 ring-primary/25"
                            : "hover:bg-muted/50",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-y-2 left-0 w-0.5 rounded-full",
                            band.rail,
                          )}
                        />
                        <p className="line-clamp-2 text-sm font-semibold">
                          {recommendation.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          @{recommendation.contributor_login} ·{" "}
                          {repositoryNameMap[recommendation.repository_id] ||
                            "Unknown repo"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px]",
                              recommendationTypeTone[
                                recommendation.recommendation_type
                              ],
                            )}
                          >
                            {formatLabel(recommendation.recommendation_type)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px]",
                              recommendationStatusTone(recommendation.status),
                            )}
                          >
                            {formatLabel(recommendation.status)}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* ------------------------------ Detail ------------------------------ */}
        <div className="min-w-0">
          {loading ? (
            <div className="space-y-6">
              <div className="h-56 animate-pulse rounded-2xl bg-muted" />
              <div className="h-72 animate-pulse rounded-2xl bg-muted" />
            </div>
          ) : selectedRecommendation ? (
            <RecommendationDetailPanel
              recommendation={selectedRecommendation}
              repositoryName={
                repositoryNameMap[selectedRecommendation.repository_id]
              }
              actions={
                <>
                  {selectedProfileId ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        router.push(
                          buildAdminWorkflowHref(
                            `/dashboard/admin/profiles/${encodeURIComponent(
                              selectedProfileId,
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
                </>
              }
            />
          ) : (
            <Card className="border-dashed border-border/60 bg-background/85">
              <CardContent className="p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Bot className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">
                  {recommendations.length === 0
                    ? "No recommendations yet"
                    : "Select a recommendation"}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  {recommendations.length === 0
                    ? "Generate one from a contributor profile and it will appear in this queue."
                    : "Choose an item from the queue to see its gaps, evidence, and generated plan."}
                </p>
                {recommendations.length === 0 ? (
                  <Button
                    variant="outline"
                    className="mt-5"
                    onClick={() =>
                      router.push(
                        buildAdminWorkflowHref(
                          "/dashboard/admin/profiles",
                          workflowContext,
                        ),
                      )
                    }
                  >
                    Go to profiles
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
