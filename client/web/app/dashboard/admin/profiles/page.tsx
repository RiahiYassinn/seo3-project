"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminWorkflowBridge } from "@/components/admin/admin-workflow-bridge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowUpRight,
  Bot,
  CircleAlert,
  FolderGit2,
  Search,
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

type ContributorGlobalProfile = {
  contributorLogin: string;
  contributorName?: string;
  contributorEmail?: string;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  analyses: ContributorProfile[];
  repositoriesCovered: number;
  completedAnalyses: number;
  averageQualityScore: number | null;
  latestAnalyzedAt: string | null;
  topWeaknesses: Array<{ category: string; occurrences: number }>;
};

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAnalysisDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Not analyzed yet";

const summaryBadgeTone =
  "border-slate-400/35 bg-slate-500/10 text-slate-700 hover:bg-slate-500/15 dark:border-slate-300/30 dark:text-slate-200";

const weaknessBadgeTone =
  "border-slate-400/35 bg-slate-500/10 text-slate-700 hover:bg-slate-500/15 dark:border-slate-300/30 dark:text-slate-200";

export default function AdminProfilesPage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [recommendationMap, setRecommendationMap] = useState<
    Record<string, RecommendationCase>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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

  const contributorProfiles = useMemo<ContributorGlobalProfile[]>(() => {
    const grouped = new Map<string, ContributorGlobalProfile>();

    profiles.forEach((profile) => {
      const normalizedLogin = String(profile.contributorLogin || "")
        .trim()
        .toLowerCase();

      if (!normalizedLogin) {
        return;
      }

      const existingGroup = grouped.get(normalizedLogin);
      if (!existingGroup) {
        grouped.set(normalizedLogin, {
          contributorLogin: profile.contributorLogin,
          contributorName: profile.contributorName,
          contributorEmail: profile.contributorEmail,
          avatarUrl: profile.avatarUrl,
          profileUrl: profile.profileUrl,
          analyses: [profile],
          repositoriesCovered: 0,
          completedAnalyses: 0,
          averageQualityScore: null,
          latestAnalyzedAt: null,
          topWeaknesses: [],
        });
        return;
      }

      existingGroup.analyses.push(profile);
      if (!existingGroup.contributorName && profile.contributorName) {
        existingGroup.contributorName = profile.contributorName;
      }
      if (!existingGroup.contributorEmail && profile.contributorEmail) {
        existingGroup.contributorEmail = profile.contributorEmail;
      }
      if (!existingGroup.avatarUrl && profile.avatarUrl) {
        existingGroup.avatarUrl = profile.avatarUrl;
      }
      if (!existingGroup.profileUrl && profile.profileUrl) {
        existingGroup.profileUrl = profile.profileUrl;
      }
    });

    return Array.from(grouped.values())
      .map((group) => {
        const analyses = [...group.analyses].sort(
          (left, right) =>
            toTimestamp(right.analyzedAt) - toTimestamp(left.analyzedAt),
        );
        const repositories = new Set(
          analyses.map(
            (analysis) => analysis.repositoryId || analysis.repositoryName,
          ),
        );
        const qualityScores = analyses
          .map((analysis) => analysis.qualityScore)
          .filter((score): score is number => typeof score === "number");
        const weaknessCountMap = new Map<
          string,
          { category: string; count: number }
        >();

        analyses.forEach((analysis) => {
          (analysis.topWeaknesses || []).forEach((weakness) => {
            const category = String(weakness.category || "").trim();
            if (!category) return;
            const weaknessKey = category.toLowerCase();
            const existingWeakness = weaknessCountMap.get(weaknessKey);
            if (!existingWeakness) {
              weaknessCountMap.set(weaknessKey, { category, count: 1 });
              return;
            }
            existingWeakness.count += 1;
          });
        });

        const topWeaknesses = Array.from(weaknessCountMap.values())
          .sort((left, right) => right.count - left.count)
          .slice(0, 4)
          .map((weakness) => ({
            category: weakness.category,
            occurrences: weakness.count,
          }));

        return {
          ...group,
          analyses,
          repositoriesCovered: repositories.size,
          completedAnalyses: analyses.filter(
            (analysis) => analysis.status === "completed",
          ).length,
          averageQualityScore: qualityScores.length
            ? qualityScores.reduce((sum, score) => sum + score, 0) /
              qualityScores.length
            : null,
          latestAnalyzedAt: analyses[0]?.analyzedAt || null,
          topWeaknesses,
        };
      })
      .sort((left, right) => {
        const byRecentActivity =
          toTimestamp(right.latestAnalyzedAt) -
          toTimestamp(left.latestAnalyzedAt);
        if (byRecentActivity !== 0) {
          return byRecentActivity;
        }
        return left.contributorLogin.localeCompare(right.contributorLogin);
      });
  }, [profiles]);

  const filteredContributorProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contributorProfiles;

    return contributorProfiles.filter((contributorProfile) => {
      if (
        contributorProfile.contributorLogin.toLowerCase().includes(query) ||
        String(contributorProfile.contributorName || "")
          .toLowerCase()
          .includes(query) ||
        String(contributorProfile.contributorEmail || "")
          .toLowerCase()
          .includes(query)
      ) {
        return true;
      }

      if (
        contributorProfile.topWeaknesses.some((weakness) =>
          weakness.category.toLowerCase().includes(query),
        )
      ) {
        return true;
      }

      return contributorProfile.analyses.some((analysis) => {
        const recommendation =
          recommendationMap[
            recommendationKey(
              analysis.repositoryId || "",
              analysis.contributorLogin,
            )
          ];

        return (
          analysis.repositoryName.toLowerCase().includes(query) ||
          String(analysis.skillLevel || "")
            .toLowerCase()
            .includes(query) ||
          analysis.status.toLowerCase().includes(query) ||
          (analysis.topWeaknesses || []).some((weakness) =>
            String(weakness.category || "")
              .toLowerCase()
              .includes(query),
          ) ||
          (analysis.recommendations || []).some((recommendationItem) =>
            `${recommendationItem.action || ""} ${recommendationItem.weakness || ""}`
              .toLowerCase()
              .includes(query),
          ) ||
          String(recommendation?.title || "")
            .toLowerCase()
            .includes(query) ||
          String(recommendation?.recommendation_type || "")
            .toLowerCase()
            .includes(query)
        );
      });
    });
  }, [contributorProfiles, recommendationMap, searchQuery]);

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

  const workflowStepStats = useMemo(
    () => ({
      analysis: {
        value: `${repositories.length}`,
        helper: "repositories feeding this workflow",
      },
      profiles: {
        value: `${contributorProfiles.length}`,
        helper: "contributors grouped into reviewable profiles",
      },
      recommendations: {
        value: `${recommendationStats.total}`,
        helper: "recommendations linked to analyzed contributors",
      },
    }),
    [contributorProfiles.length, recommendationStats.total, repositories.length],
  );

  return (
    <AdminShell
      title="Developer Skill Profiles"
      subtitle="Browse the generated contributor profiles separately from the GitHub analysis flow so reviewing weaknesses and recommendations stays focused."
      actions={
        <Button
          onClick={() => router.push("/dashboard/admin/github")}
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
        contextMessage="Profiles are the evidence-review stage of the admin workflow. Analysis creates the profile data upstream, and recommendations downstream turn the weaknesses you confirm here into concrete interventions."
        stepStats={workflowStepStats}
      />

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Contributors</p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "--" : contributorProfiles.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Repository analyses</p>
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
                Global contributor profiles
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Each contributor groups all repository analyses in one place.
              </p>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search contributors or repositories"
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContributorProfiles.length > 0 ? (
            <div className="space-y-5">
              {filteredContributorProfiles.map((contributorProfile) => (
                <div
                  key={contributorProfile.contributorLogin}
                  className="rounded-[1.75rem] border border-border/60 bg-muted/15 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar className="h-12 w-12 border border-border/60">
                        <AvatarImage
                          src={getContributorAvatarUrl(
                            contributorProfile.contributorLogin,
                            contributorProfile.avatarUrl,
                          )}
                          alt={`${contributorProfile.contributorLogin} GitHub avatar`}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(contributorProfile.contributorLogin)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-lg font-semibold">
                          @{contributorProfile.contributorLogin}
                        </p>
                        {contributorProfile.contributorName ? (
                          <p className="text-sm text-muted-foreground">
                            {contributorProfile.contributorName}
                          </p>
                        ) : null}
                        {contributorProfile.contributorEmail ? (
                          <p className="text-xs text-muted-foreground">
                            {contributorProfile.contributorEmail}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={summaryBadgeTone}>
                        {contributorProfile.analyses.length} analyses
                      </Badge>
                      <Badge variant="outline" className={summaryBadgeTone}>
                        {contributorProfile.repositoriesCovered} repositories
                      </Badge>
                      <Badge variant="outline" className={summaryBadgeTone}>
                        {contributorProfile.completedAnalyses}/
                        {contributorProfile.analyses.length} completed
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-border/60 bg-background p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Last analyzed
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {formatAnalysisDate(
                          contributorProfile.latestAnalyzedAt,
                        )}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-border/60 bg-background p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Avg quality score
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {contributorProfile.averageQualityScore !== null
                          ? `${contributorProfile.averageQualityScore.toFixed(1)}/10`
                          : "--"}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-border/60 bg-background p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Top weakness themes
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {contributorProfile.topWeaknesses.length ? (
                          contributorProfile.topWeaknesses.map((weakness) => (
                            <Badge
                              key={`${contributorProfile.contributorLogin}-${weakness.category}`}
                              variant="outline"
                            >
                              {weakness.category} ({weakness.occurrences})
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No recurring weaknesses yet.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    {contributorProfile.analyses.map((analysis) => {
                      const generatedRecommendation =
                        recommendationMap[
                          recommendationKey(
                            analysis.repositoryId || "",
                            analysis.contributorLogin,
                          )
                        ];

                      return (
                        <div
                          key={analysis.profileId}
                          className="group rounded-3xl border border-border/60 bg-background p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="inline-flex items-center gap-2 text-base font-semibold">
                                <FolderGit2 className="h-4 w-4" />
                                {analysis.repositoryName}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Profile ID: {analysis.profileId}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={statusTone(analysis.status)}
                            >
                              {analysis.status}
                            </Badge>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-border/60 bg-muted/15 p-3">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Quality
                              </p>
                              <p className="mt-2 text-xl font-semibold">
                                {analysis.qualityScore !== null
                                  ? `${analysis.qualityScore}/10`
                                  : "--"}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-muted/15 p-3">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Skill level
                              </p>
                              <p className="mt-2 text-xl font-semibold">
                                {analysis.skillLevel || "--"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-border/60 bg-muted/15 p-3">
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
                                        generatedRecommendation
                                          .recommendation_type
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
                                    {formatLabel(
                                      generatedRecommendation.status,
                                    )}
                                  </Badge>
                                </div>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {generatedRecommendation
                                ? generatedRecommendation.title
                                : "Pending generation. Recommendation appears automatically after analysis completion."}
                            </p>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {analysis.topWeaknesses?.length ? (
                              analysis.topWeaknesses
                                .slice(0, 3)
                                .map((weakness) => (
                                  <Badge
                                    key={`${analysis.profileId}-${weakness.category}`}
                                    variant="outline"
                                    className={weaknessBadgeTone}
                                  >
                                    {weakness.category || "Unknown weakness"}
                                  </Badge>
                                ))
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Weakness insights will appear when analysis
                                completes.
                              </span>
                            )}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <Button
                              size="sm"
                              className="gap-2"
                              onClick={() =>
                                router.push(
                                  `/dashboard/admin/profiles/${encodeURIComponent(analysis.profileId)}`,
                                )
                              }
                            >
                              Open detailed analysis
                              <ArrowUpRight className="h-4 w-4" />
                            </Button>

                            {analysis.profileUrl ? (
                              <a
                                href={analysis.profileUrl}
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
                </div>
              ))}
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
                Run contributor analysis from the GitHub Analysis page to
                generate profiles here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
