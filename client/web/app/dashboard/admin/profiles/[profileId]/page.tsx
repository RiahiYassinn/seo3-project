"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  BookOpen,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FolderGit2,
  Loader2,
  Mail,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  type ContributorProfile,
  type RecommendationCase,
  type RepositoryRecord,
  type Severity,
  confidencePercent,
  formatLabel,
  getContributorAvatarUrl,
  getInitials,
  normalizeContributorAnalysisSummary,
  priorityBand,
  recommendationStatusTone,
  recommendationTypeTone,
  scorePercent,
  severityTone,
  statusTone,
} from "../profile-types";
import { cn } from "@/lib/utils";

type ProfileRecord = ContributorProfile & {
  repositoryId: string;
};

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Not analyzed yet";

const pickFirstText = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
};

const toSkillKey = (value: string | null | undefined) =>
  String(value || "unknown_skill")
    .trim()
    .toLowerCase();

const qualityTone = (score: number | null | undefined) => {
  if (typeof score !== "number") return "text-foreground";
  if (score < 4) return "text-rose-600 dark:text-rose-400";
  if (score < 7) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

const severityOrder: Severity[] = ["critical", "high", "medium", "low"];

const severityBarTone: Record<Severity, string> = {
  critical: "bg-rose-500",
  high: "bg-amber-500",
  medium: "bg-sky-500",
  low: "bg-slate-400",
};

export default function AdminProfileDetailPage() {
  const params = useParams<{ profileId: string }>();
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationActionLoading, setRecommendationActionLoading] =
    useState(false);
  const [recommendation, setRecommendation] =
    useState<RecommendationCase | null>(null);
  const [error, setError] = useState("");
  const [selectedSkillKey, setSelectedSkillKey] = useState<string | null>(null);

  const profileId =
    typeof params?.profileId === "string"
      ? decodeURIComponent(params.profileId)
      : "";

  useEffect(() => {
    const loadRepositories = async () => {
      try {
        const { data } = await api.get<RepositoryRecord[]>(
          "/github/repositories",
        );
        setRepositories(data || []);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ??
            err.message ??
            "Failed to load developer profile details",
        );
      } finally {
        setLoading(false);
      }
    };

    loadRepositories();
  }, []);

  const profile = useMemo<ProfileRecord | null>(() => {
    for (const repository of repositories) {
      const profiles = Object.values(
        repository.analysis_metadata?.contributorProfiles || {},
      );
      const match = profiles.find((item) => item.profileId === profileId);
      if (match) {
        return {
          ...match,
          repositoryId: match.repositoryId || repository.id,
        };
      }
    }

    return null;
  }, [profileId, repositories]);

  const analysisSummary = useMemo(
    () =>
      normalizeContributorAnalysisSummary(
        profile?.analysisSummary ?? profile?.metadata?.analysisSummary ?? null,
      ),
    [profile],
  );

  const findings = analysisSummary?.findings || [];
  const skills = analysisSummary?.skills || profile?.skills || [];
  const resources = analysisSummary?.learning_resources || [];
  const summaryCounts =
    analysisSummary?.summary || profile?.findingsSummary || null;

  const findingsBySkill = useMemo(() => {
    return findings.reduce<Record<string, typeof findings>>((acc, finding) => {
      const key = toSkillKey(finding.skill);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(finding);
      return acc;
    }, {});
  }, [findings]);

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = {
      critical: summaryCounts?.critical_count ?? 0,
      high: summaryCounts?.high_count ?? 0,
      medium: summaryCounts?.medium_count ?? 0,
      low: summaryCounts?.low_count ?? 0,
    };

    // Fall back to counting the raw findings when no summary was stored.
    if (!summaryCounts && findings.length) {
      for (const severity of severityOrder) {
        counts[severity] = findings.filter(
          (finding) => finding.severity === severity,
        ).length;
      }
    }

    return counts;
  }, [findings, summaryCounts]);

  const totalFindings =
    summaryCounts?.finding_count ??
    (findings.length ||
      severityOrder.reduce((sum, key) => sum + severityCounts[key], 0));

  const contributorName = useMemo(
    () =>
      pickFirstText(
        profile?.contributorName,
        profile?.metadata?.contributorName,
        profile?.metadata?.name,
        profile?.analysisSummary?.analysis_metadata?.contributor_name,
        profile?.analysisSummary?.analysis_metadata?.contributorName,
      ),
    [profile],
  );

  const contributorEmail = useMemo(
    () =>
      pickFirstText(
        profile?.contributorEmail,
        profile?.metadata?.contributorEmail,
        profile?.metadata?.email,
        profile?.metadata?.authorEmail,
        profile?.analysisSummary?.analysis_metadata?.contributor_email,
        profile?.analysisSummary?.analysis_metadata?.contributorEmail,
        profile?.analysisSummary?.analysis_metadata?.author_email,
        profile?.analysisSummary?.analysis_metadata?.email,
      ),
    [profile],
  );

  const selectedSkillDetails = useMemo(() => {
    if (!selectedSkillKey) {
      return null;
    }

    const selectedSkill =
      skills.find((skill) => toSkillKey(skill.skill) === selectedSkillKey) ||
      null;
    const selectedFindings = findingsBySkill[selectedSkillKey] || [];
    const issueCount =
      typeof selectedSkill?.issue_count === "number"
        ? selectedSkill.issue_count
        : selectedFindings.length;

    return {
      skillLabel: formatLabel(selectedSkill?.skill || selectedSkillKey),
      issueCount,
      findings: selectedFindings,
    };
  }, [findingsBySkill, selectedSkillKey, skills]);

  useEffect(() => {
    const loadRecommendation = async () => {
      if (!profile?.repositoryId || !profile?.contributorLogin) {
        setRecommendation(null);
        return;
      }

      setRecommendationLoading(true);
      try {
        const { data } = await api.get<RecommendationCase | null>(
          `/recommendations/repository/${profile.repositoryId}/contributor/${encodeURIComponent(profile.contributorLogin)}`,
        );
        setRecommendation(data || null);
      } catch {
        setRecommendation(null);
      } finally {
        setRecommendationLoading(false);
      }
    };

    loadRecommendation();
  }, [profile?.contributorLogin, profile?.repositoryId]);

  const acknowledgeRecommendation = async () => {
    if (!recommendation?.id) {
      return;
    }

    setRecommendationActionLoading(true);
    try {
      const { data } = await api.post<RecommendationCase>(
        `/recommendations/${recommendation.id}/acknowledge`,
      );
      if (data) {
        setRecommendation(data);
      }
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to update recommendation status",
      );
    } finally {
      setRecommendationActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminShell
        title="Developer skill profile"
        subtitle="Loading the generated contributor analysis."
      >
        <div className="space-y-6">
          <div className="h-44 animate-pulse rounded-2xl bg-muted" />
          <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="h-80 animate-pulse rounded-2xl bg-muted" />
            <div className="h-80 animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      </AdminShell>
    );
  }

  if (!profile) {
    return (
      <AdminShell
        title="Developer skill profile"
        subtitle="The requested generated profile could not be found."
      >
        <Card className="border-dashed border-border/60 bg-background/70">
          <CardContent className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <CircleAlert className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">
              Profile not available
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {error ||
                "This generated profile is no longer available. It may have been replaced by a newer analysis run."}
            </p>
            <Button
              variant="outline"
              className="mt-5 gap-2"
              onClick={() => router.push("/dashboard/admin/profiles")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to profiles
            </Button>
          </CardContent>
        </Card>
      </AdminShell>
    );
  }

  const quality =
    typeof profile.qualityScore === "number" ? profile.qualityScore : null;

  return (
    <AdminShell
      title="Developer skill profile"
      subtitle="Weaknesses, findings, and the recommendation generated from this contributor's analysis."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => router.push("/dashboard/admin/profiles")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to profiles
          </Button>
          {profile.profileUrl ? (
            <Button asChild variant="outline" className="gap-2">
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                GitHub profile
              </a>
            </Button>
          ) : null}
        </div>
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

      {/* -------------------------------- Hero -------------------------------- */}
      <Card className="mb-6 overflow-hidden border-border/60 bg-background/85 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <Avatar className="h-16 w-16 border border-border/60 shadow-sm">
                <AvatarImage
                  src={getContributorAvatarUrl(
                    profile.contributorLogin,
                    profile.avatarUrl,
                  )}
                  alt={`${profile.contributorLogin} GitHub avatar`}
                />
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {getInitials(profile.contributorLogin)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {contributorName || `@${profile.contributorLogin}`}
                  </h2>
                  <Badge
                    variant="outline"
                    className={statusTone(profile.status)}
                  >
                    {formatLabel(profile.status)}
                  </Badge>
                </div>
                {contributorName ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    @{profile.contributorLogin}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <FolderGit2 className="h-3.5 w-3.5" />
                    {profile.repositoryName}
                  </span>
                  <span>Analyzed {formatDateTime(profile.analyzedAt)}</span>
                  {contributorEmail ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {contributorEmail}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[22rem]">
              <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Quality score
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-2xl font-semibold tabular-nums",
                    qualityTone(quality),
                  )}
                >
                  {quality !== null ? `${quality}/10` : "--"}
                </p>
                <Progress
                  value={scorePercent(quality ?? 0)}
                  className="mt-2.5 h-1.5"
                />
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Skill level
                </p>
                <p className="mt-1.5 text-2xl font-semibold capitalize">
                  {profile.skillLevel ? formatLabel(profile.skillLevel) : "--"}
                </p>
                <p
                  className="mt-2.5 truncate font-mono text-[11px] text-muted-foreground/70"
                  title={profile.profileId}
                >
                  {profile.profileId}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --------------------------- Findings summary --------------------------- */}
      <Card className="mb-6 border-border/60 bg-background/85 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Findings by severity</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {totalFindings} total · {skills.length} skill
                {skills.length === 1 ? "" : "s"} impacted · {resources.length}{" "}
                learning resource{resources.length === 1 ? "" : "s"}
              </p>
            </div>
            <p className="text-2xl font-semibold tabular-nums">
              {totalFindings}
            </p>
          </div>

          {totalFindings > 0 ? (
            <>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
                {severityOrder.map((severity) =>
                  severityCounts[severity] > 0 ? (
                    <span
                      key={severity}
                      className={severityBarTone[severity]}
                      style={{
                        width: `${(severityCounts[severity] / totalFindings) * 100}%`,
                      }}
                      title={`${severityCounts[severity]} ${severity}`}
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {severityOrder.map((severity) => (
                  <span
                    key={severity}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        severityBarTone[severity],
                      )}
                    />
                    <span className="capitalize">{severity}</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {severityCounts[severity]}
                    </span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No findings were recorded for this analysis run.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2 xl:items-start">
        {/* ---------------------------- Skill breakdown ---------------------------- */}
        <div className="space-y-6">
          <Card className="border-border/60 bg-background/85 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldAlert className="h-5 w-5" />
                Skill breakdown
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Select a skill to read the individual findings behind it.
              </p>
            </CardHeader>
            <CardContent>
              {skills.length ? (
                <div className="space-y-2">
                  {skills.map((skill) => {
                    const skillKey = toSkillKey(skill.skill);
                    const issueCount =
                      typeof skill.issue_count === "number"
                        ? skill.issue_count
                        : (findingsBySkill[skillKey] || []).length;
                    const hasDetails =
                      (findingsBySkill[skillKey] || []).length > 0;

                    return (
                      <button
                        key={skill.skill || "unknown-skill"}
                        type="button"
                        onClick={() => setSelectedSkillKey(skillKey)}
                        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/15 p-4 text-left transition-colors hover:border-primary/35 hover:bg-muted/30"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold capitalize">
                            {formatLabel(skill.skill || "unknown_skill")}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {issueCount} issue{issueCount === 1 ? "" : "s"}
                            {typeof skill.average_confidence === "number"
                              ? ` · ${confidencePercent(skill.average_confidence)} avg confidence`
                              : ""}
                            {hasDetails ? "" : " · no stored detail"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {skill.highest_severity ? (
                            <Badge
                              variant="outline"
                              className={severityTone[skill.highest_severity]}
                            >
                              {formatLabel(skill.highest_severity)}
                            </Badge>
                          ) : null}
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Skill summaries appear once a full analysis payload is
                  available for this contributor.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ---------------------------- Recommendation ---------------------------- */}
        <Card className="border-border/60 bg-background/85 shadow-sm xl:sticky xl:top-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5" />
              Generated recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recommendationLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading recommendation plan…
              </div>
            ) : recommendation ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
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
                  <Badge
                    variant="outline"
                    className={
                      priorityBand(recommendation.priority_score).badge
                    }
                    title={`Priority score ${recommendation.priority_score}`}
                  >
                    {priorityBand(recommendation.priority_score).label}
                  </Badge>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
                  <p className="font-semibold">{recommendation.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {recommendation.description}
                  </p>
                </div>

                {recommendation.recommendation_type === "mentorship" ? (
                  <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 text-sm">
                    <p className="font-medium">Mentorship assignment</p>
                    <p className="mt-1.5 text-muted-foreground">
                      {recommendation.mentor_snapshot?.name
                        ? `${recommendation.mentor_snapshot.name}${
                            recommendation.mentor_snapshot.email
                              ? ` (${recommendation.mentor_snapshot.email})`
                              : ""
                          }`
                        : "No mentor assigned yet. A tech lead can claim this from the mentor queue."}
                    </p>
                  </div>
                ) : null}

                {recommendation.recommendation_type === "learning_path" &&
                recommendation.learning_path?.steps?.length ? (
                  <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
                    <p className="font-medium">
                      Learning path ·{" "}
                      {recommendation.learning_path.steps.length} steps
                      {recommendation.learning_path.durationWeeks
                        ? ` · ${recommendation.learning_path.durationWeeks} weeks`
                        : ""}
                    </p>
                    <ol className="mt-3 space-y-2">
                      {recommendation.learning_path.steps
                        .slice(0, 3)
                        .map((step) => (
                          <li
                            key={`${recommendation.id}-${step.order}`}
                            className="flex gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5"
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-white">
                              {step.order}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {step.title || formatLabel(step.skill || "")}
                              </p>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {step.goal}
                              </p>
                            </div>
                          </li>
                        ))}
                    </ol>
                    {recommendation.learning_path.steps.length > 3 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        + {recommendation.learning_path.steps.length - 3} more
                        steps
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {recommendation.recommendation_type === "docs_review" &&
                recommendation.docs_review?.checklist?.length ? (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                    <p className="font-medium">Docs review checklist</p>
                    <div className="mt-3 space-y-2">
                      {recommendation.docs_review.checklist
                        .slice(0, 3)
                        .map((item, index) => (
                          <div
                            key={`${recommendation.id}-${index}`}
                            className="rounded-lg border border-border/60 bg-background px-3 py-2.5"
                          >
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {item.note}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                  <p className="text-xs text-muted-foreground">
                    Generated{" "}
                    {new Date(recommendation.created_at).toLocaleString()}
                  </p>
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
                      recommendationActionLoading
                    }
                    onClick={acknowledgeRecommendation}
                  >
                    {recommendationActionLoading ? (
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
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Bot className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-medium">
                  No recommendation yet
                </p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                  Generate one from the profiles list, or wait for the analysis
                  event to finish processing.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => router.push("/dashboard/admin/profiles")}
                >
                  Back to profiles
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* --------------------------- Skill findings --------------------------- */}
      <Dialog
        open={selectedSkillKey !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSkillKey(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSkillDetails?.skillLabel || "Skill"} findings
            </DialogTitle>
            <DialogDescription>
              {selectedSkillDetails?.issueCount ?? 0} issue
              {selectedSkillDetails?.issueCount === 1 ? "" : "s"} attributed to
              this skill.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {selectedSkillDetails?.findings?.length ? (
              <div className="space-y-2.5 pr-3">
                {selectedSkillDetails.findings.map((finding) => (
                  <div
                    key={`${finding.rule_id}-${finding.file_path}-${finding.line ?? 0}`}
                    className="rounded-xl border border-border/60 bg-muted/15 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{finding.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {finding.message}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          severityTone[finding.severity],
                        )}
                      >
                        {formatLabel(finding.severity)}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                      <span>
                        <span className="font-medium text-foreground">
                          Category:
                        </span>{" "}
                        {formatLabel(finding.category)}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">
                          Confidence:
                        </span>{" "}
                        {confidencePercent(finding.confidence)}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
                      {finding.file_path}
                      {typeof finding.line === "number"
                        ? `:${finding.line}`
                        : ""}
                    </p>

                    {finding.evidence?.length ? (
                      <p className="mt-2.5 rounded-lg border border-border/60 bg-background px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
                        {finding.evidence[0]}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No detailed findings are stored for this skill in the current
                profile.
              </p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
