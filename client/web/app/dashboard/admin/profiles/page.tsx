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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildAdminWorkflowHref,
  readAdminWorkflowContext,
} from "@/lib/admin-workflow";
import {
  ArrowUpRight,
  Bot,
  CircleAlert,
  Loader2,
  Sparkles,
  Users,
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
  statusTone,
} from "./profile-types";

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAnalysisDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Not analyzed yet";

const weaknessBadgeTone =
  "border-slate-400/35 bg-slate-500/10 text-slate-700 hover:bg-slate-500/15 dark:border-slate-300/30 dark:text-slate-200";

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
    return profiles.filter((profile) => {
      const matchesRepository =
        repositoryFilter === "all" ||
        (profile.repositoryId || "") === repositoryFilter;
      const matchesContributor =
        contributorFilter === "all" ||
        profile.contributorLogin === contributorFilter;

      return matchesRepository && matchesContributor;
    });
  }, [contributorFilter, profiles, repositoryFilter]);

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

  return (
    <AdminShell
      title="Developer Skill Profiles"
      subtitle="Review each contributor analysis as a separate profile so repo-wide batches stay visible from one step to the next."
      actions={
        <Button
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
          Back to Analysis
        </Button>
      }
    >
      {error && (
        <Alert className="mb-6 border-destructive/40 bg-destructive/10">
          <CircleAlert className="h-4 w-4" />
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <AdminWorkflowBridge
        currentStep="profiles"
        context={workflowContext}
        stepStats={workflowStepStats}
      />

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Contributors</p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "--" : uniqueContributorCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Profile runs</p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "--" : profiles.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Completed:{" "}
              {
                profiles.filter((profile) => profile.status === "completed")
                  .length
              }
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Repositories covered
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "--" : repositories.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">AI recommendations</p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "--" : recommendationStats.total}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Mentorship: {recommendationStats.mentorship} · Open:{" "}
              {recommendationStats.open}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/60 bg-background/80 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Contributor analysis profiles
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Each card is one contributor profile in one repository.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
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
              <select
                value={contributorFilter}
                onChange={(event) => setContributorFilter(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm lg:w-72"
              >
                <option value="all">All contributors</option>
                {contributorFilterOptions.map((contributor) => (
                  <option key={contributor.login} value={contributor.login}>
                    {contributor.label}
                    {contributor.label.startsWith("@")
                      ? ""
                      : ` (@${contributor.login})`}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  setRepositoryFilter("all");
                  setContributorFilter("all");
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProfiles.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredProfiles.map((profile) => {
                const generatedRecommendation =
                  recommendationMap[
                    recommendationKey(
                      profile.repositoryId || "",
                      profile.contributorLogin,
                    )
                  ];

                return (
                  <div
                    key={profile.profileId}
                    className="rounded-[1.75rem] border border-border/60 bg-muted/15 p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <Avatar className="h-12 w-12 border border-border/60">
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
                          <p className="text-lg font-semibold">
                            @{profile.contributorLogin}
                          </p>
                          {profile.contributorName ? (
                            <p className="text-sm text-muted-foreground">
                              {profile.contributorName}
                            </p>
                          ) : null}
                          {profile.contributorEmail ? (
                            <p className="text-xs text-muted-foreground">
                              {profile.contributorEmail}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={statusTone(profile.status)}
                        >
                          {profile.status}
                        </Badge>
                        <Badge variant="outline" className={weaknessBadgeTone}>
                          {profile.repositoryName}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-3xl border border-border/60 bg-background p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Last analyzed
                        </p>
                        <p className="mt-2 text-sm font-medium">
                          {formatAnalysisDate(profile.analyzedAt)}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-border/60 bg-background p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Quality score
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {profile.qualityScore !== null
                            ? `${profile.qualityScore}/10`
                            : "--"}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-border/60 bg-background p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Skill level
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {profile.skillLevel || "--"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-border/60 bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="inline-flex items-center gap-2 text-sm font-semibold">
                          <Bot className="h-4 w-4" />
                          Recommendation
                        </p>
                        {generatedRecommendation ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                recommendationTypeTone[
                                  generatedRecommendation.recommendation_type
                                ]
                              }
                            >
                              {formatLabel(
                                generatedRecommendation.recommendation_type,
                              )}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={recommendationStatusTone(
                                generatedRecommendation.status,
                              )}
                            >
                              {formatLabel(generatedRecommendation.status)}
                            </Badge>
                          </div>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {generatedRecommendation
                          ? generatedRecommendation.title
                          : "No recommendation generated yet. Use the button below to create one for this profile."}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {profile.topWeaknesses?.length ? (
                        profile.topWeaknesses.slice(0, 4).map((weakness) => (
                          <Badge
                            key={`${profile.profileId}-${weakness.category}`}
                            variant="outline"
                            className={weaknessBadgeTone}
                          >
                            {weakness.category || "Unknown weakness"}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Weakness insights will appear when analysis completes.
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
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
                        Open detailed analysis
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant={
                          generatedRecommendation ? "outline" : "default"
                        }
                        className="gap-2"
                        disabled={
                          generatingRecommendationKey ===
                          recommendationKey(
                            profile.repositoryId || "",
                            profile.contributorLogin,
                          )
                        }
                        onClick={() => generateRecommendation(profile)}
                      >
                        {generatingRecommendationKey ===
                        recommendationKey(
                          profile.repositoryId || "",
                          profile.contributorLogin,
                        ) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                        {generatedRecommendation
                          ? "Regenerate recommendation"
                          : "Generate recommendation"}
                      </Button>

                      {profile.profileUrl ? (
                        <a
                          href={profile.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                        >
                          View GitHub profile
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-border/60 p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="mt-4 text-lg font-semibold">
                No contributor profiles found
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Run contributor analysis from the GitHub Analysis page or reset
                the filters to see more profiles here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
