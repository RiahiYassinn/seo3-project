"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle,
  ExternalLink,
  FolderGit2,
  GitFork,
  Loader,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";

interface RepositoryDetail {
  id: string;
  repo_name: string;
  repo_url: string;
  repo_description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  is_analyzed: boolean;
  analysis_status: string | null;
  analysis_progress: number;
  analysis_current_stage: string | null;
  analysis_summary: {
    weakness_scores?: Record<string, number>;
    top_weaknesses?: Array<{
      category: string;
      score: number;
      evidence: string[];
      priority: string;
    }>;
    strengths?: string[];
    quality_score?: number;
    skill_level?: string;
    recommendations?: Array<{
      weakness: string;
      action: string;
      learning_query: string;
    }>;
  } | null;
  analysis_detected_skills: Array<Record<string, any>> | null;
  analysis_metadata: Record<string, any> | null;
  last_analyzed_at: string | null;
  last_synced: string;
}

export default function RepositoryAnalysisPage() {
  const params = useParams<{ repositoryId: string }>();
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const [repository, setRepository] = useState<RepositoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const repositoryId =
    typeof params?.repositoryId === "string" ? params.repositoryId : "";

  const loadRepository = async (isRefresh = false) => {
    if (!repositoryId) return;

    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const { data } = await api.get<RepositoryDetail>(
        `/github/repositories/${repositoryId}`,
      );
      setRepository(data);
      setError("");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err.message ??
          "Failed to load repository analysis",
      );
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "developer") {
      router.replace("/dashboard/tech_lead");
      return;
    }

    loadRepository();
  }, [hasHydrated, repositoryId, router, user]);

  useEffect(() => {
    if (!repository) return;
    if (
      repository.analysis_status !== "pending" &&
      repository.analysis_status !== "in_progress"
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      loadRepository(true).catch(() => {
        // Preserve the current screen state on temporary polling failures.
      });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [repository]);

  const formatDateTime = (value: string | null) => {
    if (!value) return "Not available";
    return new Date(value).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex h-[calc(100vh-64px)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="text-muted-foreground">Loading repository analysis...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Button variant="outline" onClick={() => router.push("/dashboard/developer/github")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to GitHub
          </Button>
          <Alert className="mt-6 border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-destructive">
              {error || "Repository not found"}
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/developer/github")}
              className="mb-4 gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to GitHub
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-bold">{repository.repo_name}</h1>
              <Badge variant="outline" className="capitalize">
                {repository.analysis_status || "not analyzed"}
              </Badge>
              {repository.analysis_summary?.skill_level && (
                <Badge variant="secondary" className="capitalize">
                  {repository.analysis_summary.skill_level}
                </Badge>
              )}
            </div>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              {repository.repo_description ||
                "This repository does not have a description yet."}
            </p>
            <a
              href={repository.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Open on GitHub
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <Button
            variant="outline"
            onClick={() => loadRepository(true)}
            disabled={refreshing}
            className="gap-2"
          >
            {refreshing ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4" />
                Refresh Status
              </>
            )}
          </Button>
        </div>

        {error && (
          <Alert className="mb-6 border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-8 rounded-3xl border border-primary/20 bg-background/90 p-6 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Analysis Progress</p>
              <p className="text-sm text-muted-foreground">
                {repository.analysis_current_stage || "Waiting to start analysis"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold">
                {repository.analysis_progress ?? 0}%
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                completion
              </p>
            </div>
          </div>
          <Progress value={repository.analysis_progress ?? 0} className="h-3" />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Last Synced
              </p>
              <p className="mt-2 font-medium">{formatDateTime(repository.last_synced)}</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Last Analyzed
              </p>
              <p className="mt-2 font-medium">
                {formatDateTime(repository.last_analyzed_at)}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Contribution Scope
              </p>
              <p className="mt-2 font-medium">
                {(repository.analysis_metadata?.developerContributionCount as number | undefined) ??
                  0}{" "}
                commits analyzed
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Repository Analysis Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                {repository.analysis_summary ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Quality Score
                        </p>
                        <p className="mt-2 text-3xl font-semibold">
                          {repository.analysis_summary.quality_score ?? "--"}/10
                        </p>
                      </div>
                      <div className="rounded-2xl border p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Skill Level
                        </p>
                        <p className="mt-2 text-3xl font-semibold capitalize">
                          {repository.analysis_summary.skill_level ?? "--"}
                        </p>
                      </div>
                      <div className="rounded-2xl border p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Top Weaknesses
                        </p>
                        <p className="mt-2 text-3xl font-semibold">
                          {repository.analysis_summary.top_weaknesses?.length ?? 0}
                        </p>
                      </div>
                      <div className="rounded-2xl border p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Recommendations
                        </p>
                        <p className="mt-2 text-3xl font-semibold">
                          {repository.analysis_summary.recommendations?.length ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border bg-green-500/5 p-5">
                        <p className="mb-3 text-sm font-semibold">Strengths</p>
                        <div className="space-y-2">
                          {(repository.analysis_summary.strengths || []).length > 0 ? (
                            repository.analysis_summary.strengths?.map((strength) => (
                              <div
                                key={strength}
                                className="flex items-start gap-2 text-sm text-muted-foreground"
                              >
                                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                <span>{strength}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Strengths will appear after analysis completes.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-amber-500/5 p-5">
                        <p className="mb-3 text-sm font-semibold">Top Weaknesses</p>
                        <div className="space-y-2">
                          {(repository.analysis_summary.top_weaknesses || []).length > 0 ? (
                            repository.analysis_summary.top_weaknesses?.map((weakness) => (
                              <div
                                key={`${weakness.category}-${weakness.priority}`}
                                className="rounded-xl border border-amber-500/20 bg-background px-3 py-3"
                              >
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <span className="font-medium capitalize">
                                    {weakness.category.replace(/_/g, " ")}
                                  </span>
                                  <Badge variant="outline" className="capitalize">
                                    {weakness.priority}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Score: {weakness.score.toFixed(2)}
                                </p>
                                {weakness.evidence?.[0] && (
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    {weakness.evidence[0]}
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Weakness hotspots will appear after analysis completes.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Analysis details will populate here as soon as this repository
                    has completed processing.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weakness Scores</CardTitle>
              </CardHeader>
              <CardContent>
                {repository.analysis_summary?.weakness_scores &&
                Object.keys(repository.analysis_summary.weakness_scores).length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {Object.entries(repository.analysis_summary.weakness_scores).map(
                      ([category, score]) => (
                      <div
                        key={category}
                        className="rounded-2xl border bg-background p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold capitalize">
                              {category.replace(/_/g, " ")}
                            </p>
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              weakness score
                            </p>
                          </div>
                          <Badge variant="outline">
                            {(score * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <Progress value={score * 100} className="h-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Weakness scores will appear here when the NLP analysis result arrives.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                {repository.analysis_summary?.recommendations &&
                repository.analysis_summary.recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {repository.analysis_summary.recommendations.map((recommendation) => (
                      <div
                        key={`${recommendation.weakness}-${recommendation.learning_query}`}
                        className="rounded-2xl border p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="font-semibold capitalize">
                            {recommendation.weakness.replace(/_/g, " ")}
                          </p>
                          <Badge variant="secondary">Actionable</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {recommendation.action}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Learning query
                        </p>
                        <p className="mt-1 text-sm">{recommendation.learning_query}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Recommendations will appear after analysis completes.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Repository Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Language
                    </span>
                    <FolderGit2 className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-lg font-semibold">
                    {repository.language || "Unknown"}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Stars
                    </span>
                    <Star className="h-4 w-4 text-yellow-500" />
                  </div>
                  <p className="text-lg font-semibold">{repository.stars}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Forks
                    </span>
                    <GitFork className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-lg font-semibold">{repository.forks}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analysis Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Contributor Count
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {(repository.analysis_metadata?.contributorCount as number | undefined) ??
                      "--"}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Files Touched
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {(repository.analysis_metadata?.filesTouched as number | undefined) ?? "--"}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Commit Count
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {(repository.analysis_metadata?.analyzedCommitCount as number | undefined) ?? "--"}
                  </p>
                </div>
                {repository.analysis_metadata?.failureReason && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-destructive">
                      Failure Reason
                    </p>
                    <p className="mt-2 text-sm text-destructive">
                      {String(repository.analysis_metadata.failureReason)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
