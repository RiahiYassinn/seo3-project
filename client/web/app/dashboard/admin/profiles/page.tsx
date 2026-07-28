"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminWorkflowBridge } from "@/components/admin/admin-workflow-bridge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
  Clock3,
  FolderGit2,
  Inbox,
  Loader2,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  type ContributorProfile,
  type RecommendationCase,
  type RepositoryRecord,
  formatLabel,
  getContributorAvatarUrl,
  getInitials,
  recommendationKey,
  recommendationStatusTone,
  recommendationTypeTone,
  scorePercent,
  statusTone,
} from "./profile-types";
import { cn } from "@/lib/utils";

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAnalysisDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : "Not analyzed yet";

const qualityTone = (score: number | null | undefined) => {
  if (typeof score !== "number") return "text-foreground";
  if (score < 4) return "text-rose-600 dark:text-rose-400";
  if (score < 7) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

const hasAnalysisActivity = (repository: RepositoryRecord) => {
  const metadata = (repository.analysis_metadata || {}) as Record<string, any>;
  const contributorProfiles = Object.values(metadata.contributorProfiles || {});

  return (
    contributorProfiles.length > 0 ||
    Boolean(metadata.contributorAnalysis) ||
    Boolean(metadata.failureReason) ||
    Boolean(metadata.lastBatchRequestedAt) ||
    Boolean((repository as any).last_analyzed_at) ||
    ["pending", "in_progress", "completed", "failed"].includes(
      String((repository as any).analysis_status || ""),
    )
  );
};

export default function AdminProfilesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const navigationContext = useMemo(
    () => readAdminWorkflowContext(searchParams),
    [searchParams],
  );
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [recommendationMap, setRecommendationMap] = useState<
    Record<string, RecommendationCase>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repositoryFilter, setRepositoryFilter] = useState<string>(
    navigationContext.repoId || "all",
  );
  const [contributorFilter, setContributorFilter] = useState<string>(
    navigationContext.contributorLogin || "all",
  );
  const [search, setSearch] = useState("");
  const [generatingRecommendationKey, setGeneratingRecommendationKey] =
    useState<string | null>(null);

  useEffect(() => {
    const loadRecommendations = async (repoRecords: RepositoryRecord[]) => {
      if (!repoRecords.length) {
        setRecommendationMap({});
        return;
      }

      const recommendationEntries = await Promise.all(
        repoRecords.map(async (repository) => {
          try {
            const { data } = await api.get<RecommendationCase[]>(
              `/recommendations/repository/${repository.id}`,
            );
            return (data || []).map((recommendation) => [
              recommendationKey(
                recommendation.repository_id,
                recommendation.contributor_login,
              ),
              recommendation,
            ]) as Array<[string, RecommendationCase]>;
          } catch {
            return [] as Array<[string, RecommendationCase]>;
          }
        }),
      );

      setRecommendationMap(
        Object.fromEntries(recommendationEntries.flat()) as Record<
          string,
          RecommendationCase
        >,
      );
    };

    const loadRepositories = async () => {
      try {
        const { data } = await api.get<RepositoryRecord[]>(
          "/github/repositories",
        );
        const repoRecords = data || [];
        setRepositories(repoRecords);
        await loadRecommendations(repoRecords);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ??
            err.message ??
            "Failed to load developer profiles",
        );
      } finally {
        setLoading(false);
      }
    };

    loadRepositories();
  }, []);

  const profiles = useMemo(() => {
    return repositories
      .flatMap((repository) =>
        Object.values(repository.analysis_metadata?.contributorProfiles || {}),
      )
      .sort((left, right) => {
        return toTimestamp(right.analyzedAt) - toTimestamp(left.analyzedAt);
      });
  }, [repositories]);

  const uniqueContributorCount = useMemo(
    () =>
      new Set(
        profiles
          .map((profile) => String(profile.contributorLogin || "").trim())
          .filter(Boolean),
      ).size,
    [profiles],
  );

  const recommendationStats = useMemo(() => {
    const records = Object.values(recommendationMap);
    return {
      total: records.length,
      mentorship: records.filter(
        (record) => record.recommendation_type === "mentorship",
      ).length,
      open: records.filter((record) => record.status === "open").length,
    };
  }, [recommendationMap]);

  const repositoryNameMap = useMemo(
    () =>
      Object.fromEntries(
        repositories.map((repository) => [repository.id, repository.repo_name]),
      ) as Record<string, string>,
    [repositories],
  );

  const analyzedRepositories = useMemo(
    () => repositories.filter((repository) => hasAnalysisActivity(repository)),
    [repositories],
  );

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
    const relevantProfiles = profiles.filter((profile) =>
      repositoryFilter === "all"
        ? true
        : (profile.repositoryId || "") === repositoryFilter,
    );
    const optionMap = new Map<
      string,
      { login: string; label: string; repositoryCount: number }
    >();

    for (const profile of relevantProfiles) {
      const login = String(profile.contributorLogin || "").trim();
      if (!login) continue;

      const current = optionMap.get(login);
      const nextLabel =
        String(profile.contributorName || "").trim() || `@${login}`;

      optionMap.set(login, {
        login,
        label: current?.label || nextLabel,
        repositoryCount: (current?.repositoryCount || 0) + 1,
      });
    }

    return Array.from(optionMap.values()).sort((left, right) =>
      left.login.localeCompare(right.login),
    );
  }, [profiles, repositoryFilter]);

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

    if (
      !contributorFilterOptions.some(
        (contributor) => contributor.login === contributorFilter,
      )
    ) {
      setContributorFilter("all");
    }
  }, [contributorFilter, contributorFilterOptions, loading]);

  const filteredProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesRepository =
        repositoryFilter === "all" ||
        (profile.repositoryId || "") === repositoryFilter;
      const matchesContributor =
        contributorFilter === "all" ||
        profile.contributorLogin === contributorFilter;

      if (!matchesRepository || !matchesContributor) {
        return false;
      }

      if (!term) return true;

      return [
        profile.contributorLogin,
        profile.contributorName,
        profile.contributorEmail,
        profile.repositoryName,
        profile.skillLevel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [contributorFilter, profiles, repositoryFilter, search]);

  const filtersActive =
    repositoryFilter !== "all" ||
    contributorFilter !== "all" ||
    search.trim() !== "";

  const resetFilters = () => {
    setRepositoryFilter("all");
    setContributorFilter("all");
    setSearch("");
  };

  const focusedProfile =
    filteredProfiles.length === 1 ? filteredProfiles[0] : null;

  const workflowContext = useMemo(
    () => ({
      repoId: focusedProfile?.repositoryId || navigationContext.repoId,
      repoName:
        (focusedProfile?.repositoryId &&
          repositoryNameMap[focusedProfile.repositoryId]) ||
        focusedProfile?.repositoryName ||
        (navigationContext.repoId
          ? repositoryNameMap[navigationContext.repoId]
          : undefined),
      contributorLogin: focusedProfile?.contributorLogin,
      profileId: focusedProfile?.profileId,
    }),
    [focusedProfile, navigationContext.repoId, repositoryNameMap],
  );

  const workflowStepStats = useMemo(
    () => ({
      analysis: `${repositories.length}`,
      profiles: `${profiles.length}`,
      recommendations: `${recommendationStats.total}`,
    }),
    [profiles.length, recommendationStats.total, repositories.length],
  );

  const generateRecommendation = async (profile: ContributorProfile) => {
    if (!profile.repositoryId || !profile.contributorLogin) {
      setError(
        "This profile is missing repository or contributor information.",
      );
      return;
    }

    const key = recommendationKey(
      profile.repositoryId,
      profile.contributorLogin,
    );
    setGeneratingRecommendationKey(key);
    setError("");

    try {
      const { data } = await api.post<RecommendationCase>(
        `/recommendations/repository/${profile.repositoryId}/contributor/${encodeURIComponent(
          profile.contributorLogin,
        )}/generate`,
      );

      if (data) {
        setRecommendationMap((current) => ({
          ...current,
          [key]: data,
        }));
      }
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to generate recommendation",
      );
    } finally {
      setGeneratingRecommendationKey(null);
    }
  };

  const summaryTiles = [
    {
      label: "Contributors",
      value: uniqueContributorCount,
      hint: "unique people analyzed",
      icon: Users,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "Profile runs",
      value: profiles.length,
      hint: `${profiles.filter((p) => p.status === "completed").length} completed`,
      icon: Sparkles,
      tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    },
    {
      label: "Repositories",
      value: repositories.length,
      hint: `${analyzedRepositories.length} with analysis`,
      icon: FolderGit2,
      tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      label: "Recommendations",
      value: recommendationStats.total,
      hint: `${recommendationStats.mentorship} mentorship · ${recommendationStats.open} open`,
      icon: Bot,
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <AdminShell
      title="Developer Skill Profiles"
      subtitle="Review each contributor analysis as a separate profile so repo-wide batches stay visible from one step to the next."
      actions={
        <Button
          variant="outline"
          onClick={() =>
            router.push(
              buildAdminWorkflowHref(
                "/dashboard/admin/github",
                workflowContext,
              ),
            )
          }
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Back to analysis
        </Button>
      }
    >
      {error && (
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
      )}

      <AdminWorkflowBridge
        currentStep="profiles"
        context={workflowContext}
        stepStats={workflowStepStats}
      />

      {/* ---------------------------- Summary bar ---------------------------- */}
      <Card className="mb-6 border-border/60 bg-background/80 shadow-sm">
        <CardContent className="grid gap-px overflow-hidden bg-border/60 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {summaryTiles.map((tile) => (
            <div
              key={tile.label}
              className="flex items-center gap-3 bg-background/95 p-4"
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  tile.tone,
                )}
              >
                <tile.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{tile.label}</p>
                <p className="text-sm font-semibold">
                  {loading ? "--" : tile.value}
                  <span className="ml-1.5 truncate font-normal text-muted-foreground">
                    · {tile.hint}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ------------------------------ Toolbar ------------------------------ */}
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold leading-tight">
            Contributor profiles
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Each card is one contributor analysed in one repository.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search contributors"
              className="pl-9"
              aria-label="Search contributor profiles"
            />
          </div>

          <Select
            value={repositoryFilter}
            onValueChange={setRepositoryFilter}
          >
            <SelectTrigger className="sm:w-52" aria-label="Filter by repository">
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

          <Select
            value={contributorFilter}
            onValueChange={setContributorFilter}
          >
            <SelectTrigger
              className="sm:w-52"
              aria-label="Filter by contributor"
            >
              <SelectValue placeholder="All contributors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All contributors</SelectItem>
              {contributorFilterOptions.map((contributor) => (
                <SelectItem key={contributor.login} value={contributor.login}>
                  {contributor.label}
                  {contributor.label.startsWith("@")
                    ? ""
                    : ` (@${contributor.login})`}
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
      </div>

      {/* ------------------------------ Profiles ------------------------------ */}
      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[0, 1, 2, 3].map((card) => (
            <div
              key={card}
              className="h-64 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      ) : filteredProfiles.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredProfiles.map((profile) => {
            const key = recommendationKey(
              profile.repositoryId || "",
              profile.contributorLogin,
            );
            const generatedRecommendation = recommendationMap[key];
            const isGenerating = generatingRecommendationKey === key;
            const quality =
              typeof profile.qualityScore === "number"
                ? profile.qualityScore
                : null;

            return (
              <Card
                key={profile.profileId}
                className="flex flex-col border-border/60 bg-background/85 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md motion-reduce:hover:translate-y-0"
              >
                <CardContent className="flex flex-1 flex-col p-5">
                  {/* Identity */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar className="h-11 w-11 border border-border/60">
                        <AvatarImage
                          src={getContributorAvatarUrl(
                            profile.contributorLogin,
                            profile.avatarUrl,
                          )}
                          alt={`${profile.contributorLogin} GitHub avatar`}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(profile.contributorLogin)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {profile.contributorName || profile.contributorLogin}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          @{profile.contributorLogin}
                        </p>
                        <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FolderGit2 className="h-3.5 w-3.5" />
                          <span className="truncate">
                            {profile.repositoryName}
                          </span>
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("shrink-0", statusTone(profile.status))}
                    >
                      {formatLabel(profile.status)}
                    </Badge>
                  </div>

                  {/* Scores */}
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                    <div className="rounded-xl border border-border/60 bg-muted/15 p-3.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Quality
                        </p>
                        <p
                          className={cn(
                            "text-lg font-semibold tabular-nums",
                            qualityTone(quality),
                          )}
                        >
                          {quality !== null ? `${quality}/10` : "--"}
                        </p>
                      </div>
                      <Progress
                        value={scorePercent(quality ?? 0)}
                        className="mt-2 h-1.5"
                      />
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/15 p-3.5">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Skill level
                      </p>
                      <p className="mt-1 truncate text-lg font-semibold capitalize">
                        {profile.skillLevel
                          ? formatLabel(profile.skillLevel)
                          : "--"}
                      </p>
                    </div>
                  </div>

                  {/* Weaknesses */}
                  <div className="mt-3.5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Top weaknesses
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.topWeaknesses?.length ? (
                        profile.topWeaknesses.slice(0, 4).map((weakness) => (
                          <Badge
                            key={`${profile.profileId}-${weakness.category}`}
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {formatLabel(
                              weakness.category || "unknown weakness",
                            )}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          None recorded for this run.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div
                    className={cn(
                      "mt-3.5 rounded-xl border p-3.5",
                      generatedRecommendation
                        ? "border-border/60 bg-muted/15"
                        : "border-dashed border-border/60",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Bot className="h-3.5 w-3.5" />
                        Recommendation
                      </p>
                      {generatedRecommendation ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              recommendationTypeTone[
                                generatedRecommendation.recommendation_type
                              ],
                            )}
                          >
                            {formatLabel(
                              generatedRecommendation.recommendation_type,
                            )}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              recommendationStatusTone(
                                generatedRecommendation.status,
                              ),
                            )}
                          >
                            {formatLabel(generatedRecommendation.status)}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {generatedRecommendation
                        ? generatedRecommendation.title
                        : "Not generated yet."}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatAnalysisDate(profile.analyzedAt)}
                    </span>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={isGenerating}
                        onClick={() => generateRecommendation(profile)}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Bot className="h-3.5 w-3.5" />
                        )}
                        {generatedRecommendation ? "Regenerate" : "Generate"}
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          router.push(
                            buildAdminWorkflowHref(
                              `/dashboard/admin/profiles/${encodeURIComponent(profile.profileId)}`,
                              {
                                repoId: profile.repositoryId,
                                repoName: profile.repositoryName,
                                contributorLogin: profile.contributorLogin,
                                profileId: profile.profileId,
                              },
                            ),
                          )
                        }
                      >
                        Open analysis
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed border-border/60 bg-background/70">
          <CardContent className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              {filtersActive ? (
                <Inbox className="h-6 w-6" />
              ) : (
                <Sparkles className="h-6 w-6" />
              )}
            </div>
            <h3 className="mt-4 text-lg font-semibold">
              {filtersActive
                ? "No profiles match these filters"
                : "No contributor profiles yet"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {filtersActive
                ? `Clear the filters to see all ${profiles.length} profiles.`
                : "Run contributor analysis from the GitHub Analysis page and the generated profiles will appear here."}
            </p>
            <Button
              variant="outline"
              className="mt-5 gap-2"
              onClick={
                filtersActive
                  ? resetFilters
                  : () =>
                      router.push(
                        buildAdminWorkflowHref(
                          "/dashboard/admin/github",
                          workflowContext,
                        ),
                      )
              }
            >
              {filtersActive ? "Clear filters" : "Go to analysis"}
            </Button>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
