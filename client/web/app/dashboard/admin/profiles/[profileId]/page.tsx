"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  BookOpen,
  CircleAlert,
  ExternalLink,
  FolderGit2,
  Gauge,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import {
  type ContributorProfile,
  type RepositoryRecord,
  confidencePercent,
  formatLabel,
  getContributorAvatarUrl,
  getInitials,
  normalizeContributorAnalysisSummary,
  scorePercent,
  severityTone,
  statusTone,
} from "../profile-types";

type ProfileRecord = ContributorProfile & {
  repositoryId: string;
};

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Not analyzed yet";

export default function AdminProfileDetailPage() {
  const params = useParams<{ profileId: string }>();
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  if (loading) {
    return (
      <AdminShell
        title="Developer Skill Profile"
        subtitle="Loading generated profile details."
      >
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </AdminShell>
    );
  }

  if (!profile) {
    return (
      <AdminShell
        title="Developer Skill Profile"
        subtitle="The requested generated profile could not be found."
      >
        <div className="space-y-6">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => router.push("/dashboard/admin/profiles")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profiles
          </Button>
          <Alert className="border-destructive/40 bg-destructive/10">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription className="text-destructive">
              {error || "This generated profile is no longer available."}
            </AlertDescription>
          </Alert>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={`@${profile.contributorLogin}`}
      subtitle="Detailed contributor analysis showing weaknesses, recommendations, and the findings behind the generated profile."
      actions={
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => router.push("/dashboard/admin/profiles")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profiles
          </Button>
          {profile.profileUrl ? (
            <Button asChild className="gap-2">
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                Open GitHub Profile
              </a>
            </Button>
          ) : null}
        </div>
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

      <section className="mb-6">
        <Card className="overflow-hidden border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar className="h-20 w-20 border border-border/60 shadow-sm">
                  <AvatarImage
                    src={getContributorAvatarUrl(
                      profile.contributorLogin,
                      profile.avatarUrl,
                    )}
                    alt={`${profile.contributorLogin} GitHub avatar`}
                  />
                  <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                    {getInitials(profile.contributorLogin)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold">
                      @{profile.contributorLogin}
                    </h2>
                    <Badge
                      variant="outline"
                      className={statusTone(profile.status)}
                    >
                      {profile.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FolderGit2 className="h-4 w-4" />
                      {profile.repositoryName}
                    </span>
                    <span className="hidden sm:inline">-</span>
                    <span>
                      Last analyzed: {formatDateTime(profile.analyzedAt)}
                    </span>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                    This generated profile is based on the selected
                    contributor's commit history and highlights coaching
                    opportunities, recurring risk areas, and recommended next
                    steps.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-border/60 bg-muted/15 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Quality score
                  </p>
                  <p className="mt-2 text-3xl font-semibold">
                    {profile.qualityScore !== null
                      ? `${profile.qualityScore}/10`
                      : "--"}
                  </p>
                  <Progress
                    value={scorePercent(profile.qualityScore ?? 0)}
                    className="mt-3 h-2"
                  />
                </div>
                <div className="rounded-3xl border border-border/60 bg-muted/15 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Skill level
                  </p>
                  <p className="mt-2 text-3xl font-semibold">
                    {profile.skillLevel || "--"}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Profile ID: {profile.profileId}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Findings</p>
            <p className="mt-2 text-2xl font-semibold">
              {summaryCounts?.finding_count ?? findings.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Critical + high</p>
            <p className="mt-2 text-2xl font-semibold">
              {(summaryCounts?.critical_count ?? 0) +
                (summaryCounts?.high_count ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Skills impacted</p>
            <p className="mt-2 text-2xl font-semibold">{skills.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Learning resources</p>
            <p className="mt-2 text-2xl font-semibold">{resources.length}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Card className="border-border/60 bg-background/80 shadow-sm">
            <CardHeader>
              <CardTitle>Detailed findings</CardTitle>
            </CardHeader>
            <CardContent>
              {findings.length ? (
                <ScrollArea className="h-[34rem] pr-4">
                  <div className="space-y-3">
                    {findings.map((finding) => (
                      <div
                        key={`${finding.rule_id}-${finding.file_path}-${finding.line ?? 0}`}
                        className="rounded-3xl border border-border/60 bg-muted/15 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{finding.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {finding.message}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={severityTone[finding.severity]}
                          >
                            {finding.severity}
                          </Badge>
                        </div>

                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                          <p>
                            <span className="font-medium text-foreground">
                              Skill:
                            </span>{" "}
                            {formatLabel(finding.skill)}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">
                              Category:
                            </span>{" "}
                            {formatLabel(finding.category)}
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
                              Confidence:
                            </span>{" "}
                            {confidencePercent(finding.confidence)}
                          </p>
                        </div>

                        {finding.evidence?.length ? (
                          <div className="mt-3 rounded-2xl border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                            {finding.evidence[0]}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Detailed findings were not stored for this profile. New
                  analyses will populate them automatically.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Learning resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resources.length ? (
                <div className="space-y-3">
                  {resources.map((resource) => (
                    <a
                      key={`${resource.skill}-${resource.url}`}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-3xl border border-border/60 bg-muted/15 p-4 transition hover:border-primary/30 hover:bg-background"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{resource.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Skill: {formatLabel(resource.skill)}
                          </p>
                        </div>
                        <Badge variant="outline">{resource.type}</Badge>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Learning resources were not included for this profile.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/60 bg-background/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Skill breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {skills.length ? (
                <div className="space-y-3">
                  {skills.map((skill) => (
                    <div
                      key={skill.skill || "unknown-skill"}
                      className="rounded-3xl border border-border/60 bg-muted/15 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold capitalize">
                            {formatLabel(skill.skill || "unknown_skill")}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {skill.issue_count ?? 0} issues
                          </p>
                        </div>
                        {skill.highest_severity ? (
                          <Badge
                            variant="outline"
                            className={severityTone[skill.highest_severity]}
                          >
                            {skill.highest_severity}
                          </Badge>
                        ) : null}
                      </div>
                      {typeof skill.average_confidence === "number" ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Avg confidence:{" "}
                          {confidencePercent(skill.average_confidence)}
                        </p>
                      ) : null}
                      {!!skill.example_titles?.length && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {skill.example_titles.slice(0, 3).map((title) => (
                            <Badge key={title} variant="secondary">
                              {title}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Skill summaries will appear when a full analysis payload is
                  available.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </AdminShell>
  );
}
