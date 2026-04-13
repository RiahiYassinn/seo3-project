"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  ExternalLink,
  FolderGit2,
  GitFork,
  Loader,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";

type Severity = "low" | "medium" | "high" | "critical";

interface SkillSummary {
  skill: string;
  issue_count: number;
  highest_severity: Severity;
  average_confidence: number;
  example_titles: string[];
}

interface Finding {
  file_path: string;
  line: number | null;
  category: string;
  skill: string;
  title: string;
  message: string;
  severity: Severity;
  confidence: number;
  rule_id: string;
  source: string;
  evidence: string[];
  related_symbols: string[];
  tags: string[];
}

interface LearningResource {
  skill: string;
  title: string;
  type: string;
  url: string;
}

interface RepositorySummary {
  version?: string;
  dominant_language?: string;
  commit_topics?: string[];
  quality_score?: number;
  summary?: {
    finding_count: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
  };
  weakness_scores?: Record<string, number>;
  skills?: SkillSummary[];
  findings?: Finding[];
  learning_resources?: LearningResource[];
  analysis_metadata?: Record<string, any>;
}

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
  analysis_summary: RepositorySummary | null;
  analysis_detected_skills: SkillSummary[] | null;
  analysis_metadata: Record<string, any> | null;
  last_analyzed_at: string | null;
  last_synced: string;
}

const severityTone: Record<Severity, string> = {
  critical: "bg-red-500/15 text-red-700 border-red-500/30",
  high: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  low: "bg-blue-500/15 text-blue-700 border-blue-500/30",
};

const formatLabel = (value: string) => value.replace(/_/g, " ");
const confidencePercent = (value: number) =>
  `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
const scorePercent = (value: number) =>
  Math.max(0, Math.min(100, (value / 10) * 100));
const FINDINGS_PAGE_SIZE = 12;

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeSummary = (rawSummary: unknown): RepositorySummary | null => {
  if (!rawSummary) return null;

  let parsed: any = rawSummary;
  if (typeof rawSummary === "string") {
    try {
      parsed = JSON.parse(rawSummary);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
  const qualityScore =
    toNumber(parsed.quality_score) ??
    toNumber(parsed.qualityScore) ??
    toNumber(parsed.score);

  const summaryCounts =
    parsed.summary && typeof parsed.summary === "object" ? parsed.summary : {};

  return {
    version: parsed.version,
    dominant_language: parsed.dominant_language ?? parsed.dominantLanguage,
    commit_topics: Array.isArray(parsed.commit_topics)
      ? parsed.commit_topics
      : Array.isArray(parsed.commitTopics)
        ? parsed.commitTopics
        : [],
    quality_score: qualityScore ?? undefined,
    summary: {
      finding_count:
        toNumber(summaryCounts.finding_count) ??
        toNumber(summaryCounts.findingCount) ??
        findings.length,
      critical_count:
        toNumber(summaryCounts.critical_count) ??
        toNumber(summaryCounts.criticalCount) ??
        findings.filter((item: any) => item?.severity === "critical").length,
      high_count:
        toNumber(summaryCounts.high_count) ??
        toNumber(summaryCounts.highCount) ??
        findings.filter((item: any) => item?.severity === "high").length,
      medium_count:
        toNumber(summaryCounts.medium_count) ??
        toNumber(summaryCounts.mediumCount) ??
        findings.filter((item: any) => item?.severity === "medium").length,
      low_count:
        toNumber(summaryCounts.low_count) ??
        toNumber(summaryCounts.lowCount) ??
        findings.filter((item: any) => item?.severity === "low").length,
    },
    weakness_scores:
      parsed.weakness_scores && typeof parsed.weakness_scores === "object"
        ? parsed.weakness_scores
        : parsed.weaknessScores && typeof parsed.weaknessScores === "object"
          ? parsed.weaknessScores
          : undefined,
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    findings,
    learning_resources: Array.isArray(parsed.learning_resources)
      ? parsed.learning_resources
      : Array.isArray(parsed.learningResources)
        ? parsed.learningResources
        : [],
    analysis_metadata:
      parsed.analysis_metadata && typeof parsed.analysis_metadata === "object"
        ? parsed.analysis_metadata
        : undefined,
  };
};

export default function RepositoryAnalysisPage() {
  const params = useParams<{ repositoryId: string }>();
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const [repository, setRepository] = useState<RepositoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | Severity>("all");
  const [visibleFindings, setVisibleFindings] = useState(FINDINGS_PAGE_SIZE);

  const repositoryId =
    typeof params?.repositoryId === "string" ? params.repositoryId : "";

  const loadRepository = useCallback(
    async (isRefresh = false) => {
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
    },
    [repositoryId],
  );

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
  }, [hasHydrated, loadRepository, router, user]);

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
        // Keep current UI state during temporary polling errors.
      });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [loadRepository, repository]);

  const formatDateTime = (value: string | null) => {
    if (!value) return "Not available";
    return new Date(value).toLocaleString();
  };

  const summary = useMemo(
    () => normalizeSummary(repository?.analysis_summary ?? null),
    [repository?.analysis_summary],
  );
  const findings = useMemo(() => summary?.findings || [], [summary]);
  const skills = useMemo(
    () => summary?.skills || repository?.analysis_detected_skills || [],
    [repository?.analysis_detected_skills, summary],
  );
  const resources = useMemo(() => summary?.learning_resources || [], [summary]);
  const filteredFindings = useMemo(
    () =>
      severityFilter === "all"
        ? findings
        : findings.filter((finding) => finding.severity === severityFilter),
    [findings, severityFilter],
  );
  const visibleFilteredFindings = useMemo(
    () => filteredFindings.slice(0, visibleFindings),
    [filteredFindings, visibleFindings],
  );
  const hiddenFindingsCount = Math.max(
    0,
    filteredFindings.length - visibleFilteredFindings.length,
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex h-[calc(100vh-64px)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="text-muted-foreground">
              Loading repository analysis...
            </p>
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
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/developer/github")}
          >
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
              {summary?.dominant_language && (
                <Badge variant="secondary" className="capitalize">
                  {summary.dominant_language}
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
                {repository.analysis_current_stage ||
                  "Waiting to start analysis"}
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
              <p className="mt-2 font-medium">
                {formatDateTime(repository.last_synced)}
              </p>
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
                Commits Analyzed
              </p>
              <p className="mt-2 font-medium">
                {(repository.analysis_metadata?.commitsAnalyzed as
                  | number
                  | undefined) ?? "--"}
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
                {summary ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Quality Score
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary.quality_score ?? "--"}/10
                      </p>
                      <Progress
                        value={scorePercent(summary.quality_score ?? 0)}
                        className="mt-2 h-2"
                      />
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Findings
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary.summary?.finding_count ?? findings.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Critical + High
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {(summary.summary?.critical_count ?? 0) +
                          (summary.summary?.high_count ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Skills Impacted
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {skills.length}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Analysis details will populate here as soon as this
                    repository has completed processing.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle>All Findings</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {(
                      ["all", "critical", "high", "medium", "low"] as const
                    ).map((level) => {
                      const count =
                        level === "all"
                          ? findings.length
                          : findings.filter(
                              (finding) => finding.severity === level,
                            ).length;

                      return (
                        <Button
                          key={level}
                          type="button"
                          size="sm"
                          variant={
                            severityFilter === level ? "default" : "outline"
                          }
                          className="capitalize"
                          onClick={() => {
                            setSeverityFilter(level);
                            setVisibleFindings(FINDINGS_PAGE_SIZE);
                          }}
                        >
                          {level} ({count})
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredFindings.length > 0 ? (
                  <>
                    <div className="mb-3 text-xs text-muted-foreground">
                      Showing {visibleFilteredFindings.length} of{" "}
                      {filteredFindings.length} findings
                    </div>
                    <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-2">
                      {visibleFilteredFindings.map((finding) => (
                        <div
                          key={`${finding.rule_id}-${finding.file_path}-${finding.line ?? 0}`}
                          className="rounded-2xl border p-4"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">{finding.title}</p>
                            <Badge
                              variant="outline"
                              className={severityTone[finding.severity]}
                            >
                              {finding.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {finding.message}
                          </p>
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                            <p>
                              <span className="font-medium text-foreground">
                                Skill:
                              </span>{" "}
                              {formatLabel(finding.skill)}
                            </p>
                            <p>
                              <span className="font-medium text-foreground">
                                Confidence:
                              </span>{" "}
                              {confidencePercent(finding.confidence)}
                            </p>
                            <p>
                              <span className="font-medium text-foreground">
                                File:
                              </span>{" "}
                              {finding.file_path}
                              {typeof finding.line === "number"
                                ? `:${finding.line}`
                                : ""}
                            </p>
                            <p>
                              <span className="font-medium text-foreground">
                                Rule:
                              </span>{" "}
                              {finding.rule_id}
                            </p>
                          </div>
                          {finding.evidence?.[0] && (
                            <p className="mt-2 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                              {finding.evidence[0]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    {hiddenFindingsCount > 0 && (
                      <div className="mt-4 flex justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setVisibleFindings(
                              (current) => current + FINDINGS_PAGE_SIZE,
                            )
                          }
                        >
                          Load{" "}
                          {Math.min(FINDINGS_PAGE_SIZE, hiddenFindingsCount)}{" "}
                          More
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {findings.length > 0
                      ? "No findings match the selected severity filter."
                      : "Findings will appear here when analysis completes."}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Learning Resources</CardTitle>
              </CardHeader>
              <CardContent>
                {resources.length > 0 ? (
                  <div className="space-y-3">
                    {resources.map((resource) => (
                      <a
                        key={`${resource.skill}-${resource.url}`}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-2xl border p-4 transition hover:border-primary/40"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="font-semibold">{resource.title}</p>
                          <Badge variant="secondary" className="capitalize">
                            {resource.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">
                          Skill: {formatLabel(resource.skill)}
                        </p>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Learning resources will appear after analysis completes.
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
                <CardTitle>Skill Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {skills.length > 0 ? (
                  skills.map((skill) => (
                    <div key={skill.skill} className="rounded-2xl border p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-semibold capitalize">
                          {formatLabel(skill.skill)}
                        </p>
                        <Badge
                          variant="outline"
                          className={severityTone[skill.highest_severity]}
                        >
                          {skill.highest_severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {skill.issue_count} issues
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Avg confidence:{" "}
                        {confidencePercent(skill.average_confidence)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Skill summaries will appear after analysis completes.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analysis Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Contributors
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {(repository.analysis_metadata?.contributorCount as
                      | number
                      | undefined) ?? "--"}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Files Touched
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {(repository.analysis_metadata?.filesTouched as
                      | number
                      | undefined) ?? "--"}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Semantic Facts
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {(repository.analysis_metadata?.nlpAnalysisMetadata
                      ?.semantic_fact_count as number | undefined) ?? "--"}
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
