"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  CircleAlert,
  CircleCheck,
  FolderGit2,
  Github,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";

interface GitHubIntegration {
  id: string;
  github_username: string;
  connected_at: string;
}

interface RepositoryRecord {
  id: string;
  repo_name: string;
  repo_url: string;
  repo_description: string | null;
  language: string | null;
  analysis_status: string | null;
  analysis_progress: number;
  analysis_current_stage: string | null;
  analysis_metadata: {
    contributorProfiles?: Record<string, ContributorProfile>;
  } | null;
}

interface ContributorRecord {
  login: string;
  display_name: string;
  contributions: number;
  avatar_url: string | null;
  profile_url: string | null;
  analysis_status: string | null;
  profile_id: string;
  last_analyzed_at: string | null;
  quality_score: number | null;
  skill_level: string | null;
  top_weaknesses: Array<{ category?: string; score?: number }>;
  recommendations: Array<{ action?: string }>;
}

interface ContributorProfile {
  profileId: string;
  contributorLogin: string;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  repositoryName: string;
  status: string;
  analyzedAt: string | null;
  qualityScore: number | null;
  skillLevel: string | null;
  strengths: string[];
  topWeaknesses: Array<{ category?: string; score?: number }>;
  recommendations: Array<{ weakness?: string; action?: string }>;
  findingsSummary: {
    finding_count?: number;
    high_count?: number;
    critical_count?: number;
  } | null;
  skills: Array<{ skill?: string; issue_count?: number }>;
}

export default function AdminGithubPage() {
  const [integration, setIntegration] = useState<GitHubIntegration | null>(null);
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [contributors, setContributors] = useState<ContributorRecord[]>([]);
  const [profiles, setProfiles] = useState<ContributorProfile[]>([]);
  const [selectedContributors, setSelectedContributors] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedRepository = useMemo(
    () => repositories.find((repository) => repository.id === selectedRepoId) || null,
    [repositories, selectedRepoId],
  );

  const profilesWithContributorData = useMemo(() => {
    const contributorMap = new Map(
      contributors.map((contributor) => [contributor.login, contributor]),
    );

    return profiles.map((profile) => {
      const contributor = contributorMap.get(profile.contributorLogin);
      return {
        ...profile,
        avatarUrl: profile.avatarUrl ?? contributor?.avatar_url ?? null,
        profileUrl: profile.profileUrl ?? contributor?.profile_url ?? null,
      };
    });
  }, [contributors, profiles]);

  const loadRepositories = async (preserveSelection = true) => {
    const { data } = await api.get<RepositoryRecord[]>("/github/repositories");
    const nextRepositories = data || [];
    setRepositories(nextRepositories);

    if (!preserveSelection || !selectedRepoId) {
      setSelectedRepoId(nextRepositories[0]?.id || "");
      return nextRepositories;
    }

    const repoStillExists = nextRepositories.some(
      (repository) => repository.id === selectedRepoId,
    );
    if (!repoStillExists) {
      setSelectedRepoId(nextRepositories[0]?.id || "");
    }

    return nextRepositories;
  };

  const loadRepositoryContext = async (repositoryId: string) => {
    if (!repositoryId) {
      setContributors([]);
      setProfiles([]);
      setSelectedContributors([]);
      return;
    }

    const [{ data: contributorData }, { data: profileData }] = await Promise.all([
      api.get<ContributorRecord[]>(`/github/repositories/${repositoryId}/contributors`),
      api.get<ContributorProfile[]>(
        `/github/repositories/${repositoryId}/contributor-profiles`,
      ),
    ]);

    setContributors(contributorData || []);
    setProfiles(profileData || []);
    setSelectedContributors((current) =>
      current.filter((login) =>
        (contributorData || []).some((contributor) => contributor.login === login),
      ),
    );
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data: integrationData } = await api.get<GitHubIntegration>(
          "/github/integration",
        );
        setIntegration(integrationData);
        setUsername(integrationData.github_username);
        const repositoryData = await loadRepositories(false);
        if (repositoryData[0]?.id) {
          await loadRepositoryContext(repositoryData[0].id);
        }
      } catch (err: any) {
        if (err?.response?.status !== 404) {
          setError(
            err?.response?.data?.message ??
              err.message ??
              "Failed to load GitHub admin flow",
          );
        }
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedRepoId || !integration) return;
    loadRepositoryContext(selectedRepoId).catch((err: any) => {
      setError(
        err?.response?.data?.message ??
          err.message ??
          "Failed to load repository contributors",
      );
    });
  }, [integration, selectedRepoId]);

  useEffect(() => {
    if (
      !integration ||
      !selectedRepository ||
      (selectedRepository.analysis_status !== "pending" &&
        selectedRepository.analysis_status !== "in_progress")
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      loadRepositories().catch(() => undefined);
      loadRepositoryContext(selectedRepository.id).catch(() => undefined);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [integration, selectedRepository]);

  const handleLinkGitHub = async (event: FormEvent) => {
    event.preventDefault();
    setLinking(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.post<GitHubIntegration>("/github/integration", {
        github_username: username,
        github_token: token,
      });

      setIntegration(data);
      setToken("");
      setSuccess("GitHub linked successfully. You can sync repositories now.");
      const repositoryData = await loadRepositories(false);
      if (repositoryData[0]?.id) {
        await loadRepositoryContext(repositoryData[0].id);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err.message ??
          "Failed to link GitHub account",
      );
    } finally {
      setLinking(false);
    }
  };

  const handleSyncRepositories = async () => {
    setSyncing(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/github/sync");
      const repositoryData = await loadRepositories(false);
      if (repositoryData[0]?.id) {
        await loadRepositoryContext(repositoryData[0].id);
      }
      setSuccess("Repositories synced successfully.");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err.message ??
          "Failed to sync repositories",
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedRepoId || selectedContributors.length === 0) return;

    setRunning(true);
    setError("");
    setSuccess("");

    try {
      await api.post(`/github/repositories/${selectedRepoId}/analyze-contributors`, {
        contributor_logins: selectedContributors,
      });
      setSuccess(
        `Contributor analysis queued for ${selectedContributors.length} selected contributor(s).`,
      );
      await loadRepositories();
      await loadRepositoryContext(selectedRepoId);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err.message ??
          "Failed to start contributor analysis",
      );
    } finally {
      setRunning(false);
    }
  };

  const statusTone = (status: string | null) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
      case "failed":
        return "bg-red-500/10 text-red-700 border-red-500/30";
      case "pending":
      case "in_progress":
        return "bg-amber-500/10 text-amber-700 border-amber-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatDateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "Not analyzed yet";

  const getInitials = (value: string) =>
    value
      .split(/[\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "GH";

  return (
    <AdminShell
      title="GitHub Repository and Contributor Analysis"
      subtitle="Link GitHub as the admin, choose a repository, select contributors, and generate developer skill profiles directly from their commit history."
      actions={
        integration ? (
          <Button
            type="button"
            onClick={handleSyncRepositories}
            variant="outline"
            className="gap-2"
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync repositories
          </Button>
        ) : null
      }
    >
      {error && (
        <Alert className="mb-6 border-destructive/40 bg-destructive/10">
          <CircleAlert className="h-4 w-4" />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-6 border-emerald-500/40 bg-emerald-500/10">
          <CircleCheck className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700">{success}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : !integration ? (
        <Card className="border-border/60 bg-background/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Link the admin GitHub account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLinkGitHub} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">GitHub username</label>
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="octocat"
                  disabled={linking}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Personal access token</label>
                <Input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  disabled={linking}
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  className="gap-2"
                  disabled={linking || !username || !token}
                >
                  {linking && <Loader2 className="h-4 w-4 animate-spin" />}
                  Link GitHub
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <Card className="border-border/60 bg-background/80">
              <CardHeader>
                <CardTitle>1. Choose a repository</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="font-semibold">Connected as @{integration.github_username}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This admin connection controls repository sync and contributor analysis.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Repository</label>
                  <select
                    value={selectedRepoId}
                    onChange={(event) => setSelectedRepoId(event.target.value)}
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    {repositories.map((repository) => (
                      <option key={repository.id} value={repository.id}>
                        {repository.repo_name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRepository ? (
                  <div className="rounded-2xl border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{selectedRepository.repo_name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedRepository.repo_description ||
                            "No repository description provided."}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={statusTone(selectedRepository.analysis_status)}
                      >
                        {selectedRepository.analysis_status || "idle"}
                      </Badge>
                    </div>
                    <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span>Batch progress</span>
                        <span>{selectedRepository.analysis_progress || 0}%</span>
                      </div>
                      <Progress value={selectedRepository.analysis_progress || 0} className="h-2.5" />
                      <p className="mt-2 text-xs text-muted-foreground">
                        {selectedRepository.analysis_current_stage ||
                          "Select contributors to start a new analysis batch."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                    Sync repositories to begin the contributor analysis flow.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/80">
              <CardHeader>
                <CardTitle>2. Select contributors and run analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Pick the contributors whose commits should feed the generated developer profile.
                  </p>
                  <Button
                    type="button"
                    onClick={handleRunAnalysis}
                    disabled={
                      running ||
                      !selectedRepoId ||
                      selectedContributors.length === 0 ||
                      selectedRepository?.analysis_status === "pending" ||
                      selectedRepository?.analysis_status === "in_progress"
                    }
                    className="gap-2"
                  >
                    {running ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Run analysis
                  </Button>
                </div>

                <div className="grid gap-3">
                  {contributors.map((contributor) => {
                    const checked = selectedContributors.includes(contributor.login);

                    return (
                      <label
                        key={contributor.login}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 p-4 transition hover:border-primary/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            setSelectedContributors((current) =>
                              nextChecked
                                ? [...current, contributor.login]
                                : current.filter((login) => login !== contributor.login),
                            );
                          }}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-11 w-11 border border-border/60">
                                <AvatarImage
                                  src={contributor.avatar_url || undefined}
                                  alt={`${contributor.display_name} GitHub avatar`}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(contributor.display_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold">@{contributor.display_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {contributor.contributions} contributions
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={statusTone(contributor.analysis_status)}
                              >
                                {contributor.analysis_status || "not analyzed"}
                              </Badge>
                              {contributor.quality_score !== null && (
                                <Badge variant="secondary">
                                  Score {contributor.quality_score}/10
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Last profile update: {formatDateTime(contributor.last_analyzed_at)}
                          </p>
                        </div>
                      </label>
                    );
                  })}

                  {contributors.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                      Contributors will appear here after you select a repository.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="mt-8">
            <Card className="border-border/60 bg-background/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Generated developer skill profiles
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profilesWithContributorData.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {profilesWithContributorData.map((profile) => (
                      <div
                        key={profile.profileId}
                        className="rounded-3xl border border-border/60 bg-muted/20 p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 border border-border/60">
                              <AvatarImage
                                src={profile.avatarUrl || undefined}
                                alt={`${profile.contributorLogin} GitHub avatar`}
                              />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {getInitials(profile.contributorLogin)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-lg font-semibold">
                                @{profile.contributorLogin}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {profile.repositoryName}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={statusTone(profile.status)}
                          >
                            {profile.status}
                          </Badge>
                        </div>

                        {profile.profileUrl && (
                          <a
                            href={profile.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
                          >
                            View GitHub profile
                          </a>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-border/60 bg-background p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              Quality score
                            </p>
                            <p className="mt-2 text-2xl font-semibold">
                              {profile.qualityScore !== null
                                ? `${profile.qualityScore}/10`
                                : "--"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-background p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              Skill level
                            </p>
                            <p className="mt-2 text-2xl font-semibold">
                              {profile.skillLevel || "--"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-sm font-semibold">Top weaknesses</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {profile.topWeaknesses?.length ? (
                              profile.topWeaknesses.slice(0, 3).map((weakness) => (
                                <Badge key={`${profile.profileId}-${weakness.category}`} variant="secondary">
                                  {weakness.category || "Unknown weakness"}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Weakness insights will appear when analysis completes.
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-sm font-semibold">Recommendations</p>
                          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {profile.recommendations?.length ? (
                              profile.recommendations.slice(0, 2).map((recommendation, index) => (
                                <div
                                  key={`${profile.profileId}-${index}`}
                                  className="rounded-2xl border border-border/60 bg-background px-3 py-2"
                                >
                                  {recommendation.action || recommendation.weakness}
                                </div>
                              ))
                            ) : (
                              <p>No recommendations yet.</p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-border/60 bg-background p-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Findings</span>
                            <span className="font-medium">
                              {profile.findingsSummary?.finding_count ?? 0}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>
                              Critical: {profile.findingsSummary?.critical_count ?? 0}
                            </span>
                            <span>
                              High: {profile.findingsSummary?.high_count ?? 0}
                            </span>
                            <span>Skills: {profile.skills?.length ?? 0}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <FolderGit2 className="h-6 w-6" />
                    </div>
                    <p className="mt-4 text-lg font-semibold">
                      No contributor profiles yet
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Select a repository, choose contributors, and run the analysis to generate skill profiles here.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </AdminShell>
  );
}
