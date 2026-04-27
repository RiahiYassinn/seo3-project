"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  CircleAlert,
  CircleCheck,
  FolderGit2,
  GitBranch,
  Github,
  Loader2,
  RefreshCw,
  Sparkles,
  Unlink,
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

const getInitials = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "GH";

const getRepositoryStatusLabel = (status: string | null) => {
  if (status === "in_progress") return "In progress";
  if (status === "pending") return "Queued";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Ready";
};

export default function AdminGithubPage() {
  const router = useRouter();
  const [integration, setIntegration] = useState<GitHubIntegration | null>(
    null,
  );
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [contributors, setContributors] = useState<ContributorRecord[]>([]);
  const [profiles, setProfiles] = useState<ContributorProfile[]>([]);
  const [selectedContributors, setSelectedContributors] = useState<string[]>(
    [],
  );
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedRepository = useMemo(
    () =>
      repositories.find((repository) => repository.id === selectedRepoId) ||
      null,
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

    const [{ data: contributorData }, { data: profileData }] =
      await Promise.all([
        api.get<ContributorRecord[]>(
          `/github/repositories/${repositoryId}/contributors`,
        ),
        api.get<ContributorProfile[]>(
          `/github/repositories/${repositoryId}/contributor-profiles`,
        ),
      ]);

    setContributors(contributorData || []);
    setProfiles(profileData || []);
    setSelectedContributors((current) =>
      current.filter((login) =>
        (contributorData || []).some(
          (contributor) => contributor.login === login,
        ),
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
        selectedRepository.analysis_status !== "in progress")
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
      const { data } = await api.post<GitHubIntegration>(
        "/github/integration",
        {
          github_username: username,
          github_token: token,
        },
      );

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

  const handleUnlinkGitHub = async () => {
    if (!integration) {
      return;
    }

    if (
      !confirm(
        "Are you sure you want to unlink this GitHub account? This will remove all synced repositories for this admin integration.",
      )
    ) {
      return;
    }

    setUnlinking(true);
    setError("");
    setSuccess("");

    try {
      await api.delete("/github/integration");
      setIntegration(null);
      setRepositories([]);
      setSelectedRepoId("");
      setContributors([]);
      setProfiles([]);
      setSelectedContributors([]);
      setUsername("");
      setToken("");
      setSuccess("GitHub account unlinked successfully.");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err.message ??
          "Failed to unlink GitHub account",
      );
    } finally {
      setUnlinking(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedRepoId || selectedContributors.length === 0) return;

    setRunning(true);
    setError("");
    setSuccess("");

    try {
      await api.post(
        `/github/repositories/${selectedRepoId}/analyze-contributors`,
        {
          contributor_logins: selectedContributors,
        },
      );
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

  const formatDateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "Not analyzed yet";

  return (
    <AdminShell
      title="GitHub Repository and Contributor Analysis"
      subtitle="Connect GitHub, choose a repository, select contributors, and run analysis. Each generated profile now automatically receives a recommendation plan visible in admin workflow."
      actions={
        integration ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleSyncRepositories}
              variant="outline"
              className="gap-2"
              disabled={syncing || unlinking}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync repositories
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              onClick={handleUnlinkGitHub}
              disabled={unlinking || syncing || running}
            >
              {unlinking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              {unlinking ? "Unlinking..." : "Unlink GitHub"}
            </Button>
          </div>
        ) : null
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
      {success && (
        <Alert className="mb-6 border-emerald-500/40 bg-emerald-500/10">
          <CircleCheck className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : !integration ? (
        <Card className="mx-auto max-w-4xl border-border/60 bg-background/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Link the admin GitHub account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleLinkGitHub}
              className="grid gap-4 md:grid-cols-2"
            >
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
                <label className="text-sm font-medium">
                  Personal access token
                </label>
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
          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 bg-background/80 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">
                  Connected account
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  @{integration.github_username}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Admin-owned GitHub integration
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-background/80 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Repositories</p>
                <p className="mt-2 text-2xl font-semibold">
                  {repositories.length}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Available for contributor analysis
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-background/80 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">
                  Profiles generated
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {profilesWithContributorData.length}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review them on the dedicated profiles page
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <Card className="border-border/60 bg-background/80 shadow-sm">
              <CardHeader>
                <CardTitle>1. Choose a repository</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <p className="font-semibold">
                    Connected as @{integration.github_username}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This admin connection controls repository sync and
                    contributor analysis.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Repository</label>
                  <Select
                    value={selectedRepoId}
                    onValueChange={(value) => setSelectedRepoId(value)}
                  >
                    <SelectTrigger className="h-16 rounded-3xl border-border/70 bg-background px-4 shadow-sm">
                      <div className="flex min-w-0 items-center gap-3 text-left">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <FolderGit2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                            Selected repository
                          </p>
                          <div className="truncate text-sm font-semibold">
                            {selectedRepository?.repo_name ||
                              "Choose a repository"}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {selectedRepository
                              ? `${selectedRepository.language || "Unknown stack"} - ${getRepositoryStatusLabel(selectedRepository.analysis_status)}`
                              : "Pick a repository to load contributors"}
                          </div>
                        </div>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-3xl border-border/70 bg-background/95 p-2 backdrop-blur-xl">
                      {repositories.map((repository) => (
                        <SelectItem
                          key={repository.id}
                          value={repository.id}
                          className="rounded-2xl px-10 py-4 focus:bg-emerald-500/10 focus:text-emerald-700 data-[state=checked]:bg-emerald-500/10 data-[state=checked]:text-emerald-700"
                        >
                          <div className="flex min-w-0 items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {repository.repo_name}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <GitBranch className="h-3 w-3" />
                                  {repository.language || "Unknown stack"}
                                </span>
                                <span>-</span>
                                <span>
                                  {getRepositoryStatusLabel(
                                    repository.analysis_status,
                                  )}
                                </span>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={statusTone(repository.analysis_status)}
                            >
                              {repository.analysis_progress || 0}%
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRepository ? (
                  <div className="rounded-3xl border border-border/60 bg-muted/15 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">
                          {selectedRepository.repo_name}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedRepository.repo_description ||
                            "No repository description provided."}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={statusTone(
                          selectedRepository.analysis_status,
                        )}
                      >
                        {selectedRepository.analysis_status || "idle"}
                      </Badge>
                    </div>
                    <div className="mt-5 rounded-3xl border border-border/60 bg-background p-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span>Batch progress</span>
                        <span>
                          {selectedRepository.analysis_progress || 0}%
                        </span>
                      </div>
                      <Progress
                        value={selectedRepository.analysis_progress || 0}
                        className="h-2.5"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        {selectedRepository.analysis_current_stage ||
                          "Select contributors to start a new analysis batch."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                    Sync repositories to begin the contributor analysis flow.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/80 shadow-sm">
              <CardHeader>
                <CardTitle>2. Select contributors and run analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Pick the contributors whose commits should feed the
                    generated developer profile.
                  </p>
                  <Button
                    type="button"
                    onClick={handleRunAnalysis}
                    disabled={
                      running ||
                      !selectedRepoId ||
                      selectedContributors.length === 0 ||
                      selectedRepository?.analysis_status === "pending" ||
                      selectedRepository?.analysis_status === "in progress"
                    }
                    className="gap-2 sm:min-w-[170px]"
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
                    const checked = selectedContributors.includes(
                      contributor.login,
                    );

                    return (
                      <label
                        key={contributor.login}
                        className="flex cursor-pointer items-start gap-3 rounded-3xl border border-border/60 bg-muted/15 p-4 transition hover:border-primary/40 hover:bg-muted/30"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            setSelectedContributors((current) =>
                              nextChecked
                                ? [...current, contributor.login]
                                : current.filter(
                                    (login) => login !== contributor.login,
                                  ),
                            );
                          }}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="h-11 w-11 border border-border/60">
                                <AvatarImage
                                  src={contributor.avatar_url || undefined}
                                  alt={`${contributor.display_name} GitHub avatar`}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(contributor.display_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-semibold">
                                  @{contributor.display_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {contributor.contributions} contributions
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={statusTone(
                                  contributor.analysis_status,
                                )}
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
                            Last profile update:{" "}
                            {formatDateTime(contributor.last_analyzed_at)}
                          </p>
                        </div>
                      </label>
                    );
                  })}

                  {contributors.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                      Contributors will appear here after you select a
                      repository.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </AdminShell>
  );
}
