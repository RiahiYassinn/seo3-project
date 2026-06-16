"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminWorkflowBridge } from "@/components/admin/admin-workflow-bridge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { readAdminWorkflowContext } from "@/lib/admin-workflow";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  Bot,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  GitBranch,
  Github,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Unlink,
} from "lucide-react";
import {
  formatLabel,
  getContributorAvatarUrl,
  getInitials,
  normalizeContributorAnalysisSummary,
  severityTone,
  statusTone,
} from "../profiles/profile-types";

interface GitHubIntegration {
  id: string;
  github_username: string;
  connected_at: string;
}

interface ContributorAnalysisState {
  total: number;
  queue: string[];
  activeContributor: string | null;
  processed: string[];
  failed: string[];
  requestedAt: string;
  requestedBy: string;
}

interface RepositoryRecord {
  id: string;
  repo_name: string;
  repo_url: string;
  repo_description: string | null;
  language: string | null;
  stars?: number;
  forks?: number;
  analysis_status: string | null;
  analysis_progress: number;
  analysis_current_stage: string | null;
  last_analyzed_at?: string | null;
  last_synced?: string | null;
  analysis_metadata: {
    contributorProfiles?: Record<string, ContributorProfile>;
    contributorAnalysis?: ContributorAnalysisState;
    failureReason?: string;
    lastBatchRequestedAt?: string;
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
  contributorName?: string;
  contributorEmail?: string;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  repositoryName: string;
  repositoryId?: string;
  status: string;
  analyzedAt: string | null;
  qualityScore: number | null;
  skillLevel: string | null;
  strengths?: string[];
  topWeaknesses: Array<{ category?: string; score?: number }>;
  recommendations: Array<{
    weakness?: string;
    action?: string;
    learning_query?: string;
    type?: string;
  }>;
  findingsSummary: {
    finding_count?: number;
    high_count?: number;
    critical_count?: number;
    medium_count?: number;
    low_count?: number;
  } | null;
  skills: Array<{
    skill?: string;
    issue_count?: number;
    highest_severity?: "low" | "medium" | "high" | "critical";
    average_confidence?: number;
    example_titles?: string[];
  }>;
  analysisSummary?: Record<string, unknown> | null;
  metadata?: Record<string, any>;
}

const getRepositoryStatusLabel = (status: string | null) => {
  if (status === "in_progress") return "In progress";
  if (status === "pending") return "Queued";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Ready";
};

const getContributorStatusLabel = (status: string | null) =>
  status ? status.replaceAll("_", " ") : "not analyzed";

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "Not available";

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getProfileFailureReason = (profile: ContributorProfile | null) => {
  const value = profile?.metadata?.failureReason;
  return typeof value === "string" && value.trim()
    ? value
    : "Failure reason not provided.";
};

const repositoryStatusPriority: Record<string, number> = {
  completed: 0,
  failed: 1,
  in_progress: 2,
  pending: 3,
};

const sortRepositoriesForExplorer = (repositories: RepositoryRecord[]) =>
  [...repositories].sort((left, right) => {
    const leftPriority =
      repositoryStatusPriority[left.analysis_status ?? ""] ?? 4;
    const rightPriority =
      repositoryStatusPriority[right.analysis_status ?? ""] ?? 4;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const byRecentAnalysis =
      toTimestamp(right.last_analyzed_at) - toTimestamp(left.last_analyzed_at);
    if (byRecentAnalysis !== 0) {
      return byRecentAnalysis;
    }

    const byRecentSync =
      toTimestamp(right.last_synced) - toTimestamp(left.last_synced);
    if (byRecentSync !== 0) {
      return byRecentSync;
    }

    return left.repo_name.localeCompare(right.repo_name);
  });

export default function AdminGithubPage() {
  const searchParams = useSearchParams();
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
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const [contributorSearchQuery, setContributorSearchQuery] = useState(
    () => readAdminWorkflowContext(searchParams).contributorLogin || "",
  );
  const [hasClearedContributorFocus, setHasClearedContributorFocus] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [repositoryContextLoading, setRepositoryContextLoading] =
    useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigationContext = useMemo(
    () => readAdminWorkflowContext(searchParams),
    [searchParams],
  );

  const selectedRepository = useMemo(
    () =>
      repositories.find((repository) => repository.id === selectedRepoId) ||
      null,
    [repositories, selectedRepoId],
  );

  const sortedRepositories = useMemo(
    () => sortRepositoriesForExplorer(repositories),
    [repositories],
  );

  const filteredRepositories = useMemo(() => {
    const query = repoSearchQuery.trim().toLowerCase();
    if (!query) return sortedRepositories;

    return sortedRepositories.filter((repository) =>
      [
        repository.repo_name,
        repository.repo_description,
        repository.language,
        repository.analysis_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [repoSearchQuery, sortedRepositories]);

  const profilesWithContributorData = useMemo(() => {
    const contributorMap = new Map(
      contributors.map((contributor) => [contributor.login, contributor]),
    );

    return [...profiles]
      .map((profile) => {
        const contributor = contributorMap.get(profile.contributorLogin);
        return {
          ...profile,
          avatarUrl: profile.avatarUrl ?? contributor?.avatar_url ?? null,
          profileUrl: profile.profileUrl ?? contributor?.profile_url ?? null,
          contributorName:
            profile.contributorName ?? contributor?.display_name ?? undefined,
        };
      })
      .sort((left, right) => {
        const byActivity =
          toTimestamp(right.analyzedAt) - toTimestamp(left.analyzedAt);
        if (byActivity !== 0) return byActivity;
        return left.contributorLogin.localeCompare(right.contributorLogin);
      });
  }, [contributors, profiles]);

  const profileByLogin = useMemo(
    () =>
      new Map(
        profilesWithContributorData.map((profile) => [
          profile.contributorLogin,
          profile,
        ]),
      ),
    [profilesWithContributorData],
  );

  const selectedProfile = useMemo(
    () =>
      profilesWithContributorData.find(
        (profile) => profile.profileId === selectedProfileId,
      ) || null,
    [profilesWithContributorData, selectedProfileId],
  );

  const selectedProfileSummary = useMemo(
    () =>
      normalizeContributorAnalysisSummary(
        selectedProfile?.analysisSummary ??
          selectedProfile?.metadata?.analysisSummary ??
          null,
      ),
    [selectedProfile],
  );

  const selectedBatchState =
    selectedRepository?.analysis_metadata?.contributorAnalysis ?? null;
  const repositoryFailureReason =
    selectedRepository?.analysis_metadata?.failureReason ?? null;

  const filteredContributors = useMemo(() => {
    const query = contributorSearchQuery.trim().toLowerCase();
    if (!query) return contributors;

    return contributors.filter((contributor) =>
      [
        contributor.login,
        contributor.display_name,
        contributor.skill_level,
        contributor.analysis_status,
        ...contributor.top_weaknesses.map(
          (weakness) => weakness.category || "",
        ),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [contributorSearchQuery, contributors]);

  const selectedContributorCount = selectedContributors.length;
  const completedProfileCount = profilesWithContributorData.filter(
    (profile) => profile.status === "completed",
  ).length;
  const failedProfileCount = profilesWithContributorData.filter(
    (profile) => profile.status === "failed",
  ).length;
  const focusedContributorLogin = useMemo(() => {
    if (filteredContributors.length === 1) {
      return filteredContributors[0]?.login || undefined;
    }

    if (selectedContributors.length === 1) {
      return selectedContributors[0];
    }

    return undefined;
  }, [filteredContributors, selectedContributors]);
  const workflowContext = useMemo(
    () => ({
      repoId: selectedRepository?.id || navigationContext.repoId,
      repoName: selectedRepository?.repo_name,
      contributorLogin: focusedContributorLogin,
      profileId:
        focusedContributorLogin &&
        selectedProfile?.contributorLogin === focusedContributorLogin
          ? selectedProfile.profileId
          : undefined,
    }),
    [
      focusedContributorLogin,
      navigationContext.repoId,
      selectedProfile,
      selectedRepository,
    ],
  );
  const workflowStepStats = useMemo(
    () => ({
      analysis: `${repositories.length}`,
      profiles: `${profilesWithContributorData.length}`,
      recommendations: `${completedProfileCount}`,
    }),
    [
      completedProfileCount,
      profilesWithContributorData.length,
      repositories.length,
    ],
  );

  useEffect(() => {
    if (
      hasClearedContributorFocus ||
      !navigationContext.contributorLogin ||
      contributorSearchQuery
    ) {
      return;
    }
    setContributorSearchQuery(navigationContext.contributorLogin);
  }, [
    contributorSearchQuery,
    hasClearedContributorFocus,
    navigationContext.contributorLogin,
  ]);

  useEffect(() => {
    setSelectedProfileId((current) => {
      if (
        current &&
        profilesWithContributorData.some(
          (profile) => profile.profileId === current,
        )
      ) {
        return current;
      }
      return profilesWithContributorData[0]?.profileId || "";
    });
  }, [profilesWithContributorData]);

  useEffect(() => {
    if (!profilesWithContributorData.length) {
      return;
    }

    if (navigationContext.profileId) {
      const profileMatch = profilesWithContributorData.find(
        (profile) => profile.profileId === navigationContext.profileId,
      );
      if (profileMatch && selectedProfileId !== profileMatch.profileId) {
        setSelectedProfileId(profileMatch.profileId);
        return;
      }
    }

    if (!navigationContext.contributorLogin) {
      return;
    }

    const contributorMatch = profilesWithContributorData.find(
      (profile) =>
        profile.contributorLogin === navigationContext.contributorLogin,
    );
    if (contributorMatch && selectedProfileId !== contributorMatch.profileId) {
      setSelectedProfileId(contributorMatch.profileId);
    }
  }, [
    navigationContext.contributorLogin,
    navigationContext.profileId,
    profilesWithContributorData,
    selectedProfileId,
  ]);

  const loadRepositories = async (preserveSelection = true) => {
    const { data } = await api.get<RepositoryRecord[]>("/github/repositories");
    const nextRepositories = data || [];
    const sortedNextRepositories =
      sortRepositoriesForExplorer(nextRepositories);
    setRepositories(nextRepositories);
    const preferredRepository = navigationContext.repoId
      ? nextRepositories.find(
          (repository) => repository.id === navigationContext.repoId,
        )
      : null;

    if (!preserveSelection || !selectedRepoId) {
      setSelectedRepoId(
        preferredRepository?.id || sortedNextRepositories[0]?.id || "",
      );
      return nextRepositories;
    }

    const repoStillExists = nextRepositories.some(
      (repository) => repository.id === selectedRepoId,
    );
    if (!repoStillExists) {
      setSelectedRepoId(sortedNextRepositories[0]?.id || "");
    }

    return nextRepositories;
  };

  const loadRepositoryContext = async (repositoryId: string) => {
    if (!repositoryId) {
      setContributors([]);
      setProfiles([]);
      setSelectedContributors([]);
      setSelectedProfileId("");
      return;
    }

    setRepositoryContextLoading(true);
    try {
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
    } finally {
      setRepositoryContextLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data: integrationData } = await api.get<GitHubIntegration>(
          "/github/integration",
        );
        setIntegration(integrationData);
        setUsername(integrationData.github_username);
        await loadRepositories(false);
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
      setSelectedProfileId("");
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

  const toggleContributorSelection = (login: string, nextChecked?: boolean) => {
    setSelectedContributors((current) => {
      const checked =
        typeof nextChecked === "boolean"
          ? nextChecked
          : !current.includes(login);

      if (checked) {
        return current.includes(login) ? current : [...current, login];
      }

      return current.filter((value) => value !== login);
    });
  };

  const selectAllVisibleContributors = () => {
    setSelectedContributors((current) => {
      const next = new Set(current);
      filteredContributors.forEach((contributor) =>
        next.add(contributor.login),
      );
      return Array.from(next);
    });
  };

  const clearSelectedContributors = () => {
    setSelectedContributors([]);
  };

  return (
    <AdminShell
      title="GitHub Repository and Contributor Analysis"
      subtitle="Search repositories quickly, run contributor analysis in batches, and inspect results or failures without leaving the workspace."
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
          <AdminWorkflowBridge
            currentStep="analysis"
            context={workflowContext}
            stepStats={workflowStepStats}
          />

          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  {filteredRepositories.length} visible in the current search
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-background/80 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">
                  Contributors in repo
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {selectedRepository ? contributors.length : "--"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedContributorCount} selected for the next run
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-background/80 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">
                  Analysis results
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {selectedRepository
                    ? profilesWithContributorData.length
                    : "--"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {completedProfileCount} completed, {failedProfileCount} failed
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <Card className="border-border/60 bg-background/80 shadow-sm">
              <CardHeader>
                <CardTitle>Selected repository</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedRepository ? (
                  <>
                    <div className="rounded-[1.5rem] border border-border/60 bg-muted/15 p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xl font-semibold">
                            {selectedRepository.repo_name}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {selectedRepository.repo_description ||
                              "No repository description provided."}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge
                              variant="outline"
                              className={statusTone(
                                selectedRepository.analysis_status,
                              )}
                            >
                              {getRepositoryStatusLabel(
                                selectedRepository.analysis_status,
                              )}
                            </Badge>
                            <span>
                              Last analyzed:{" "}
                              {formatDateTime(
                                selectedRepository.last_analyzed_at,
                              )}
                            </span>
                          </div>
                        </div>

                        <Button asChild variant="outline" className="gap-2">
                          <a
                            href={selectedRepository.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open repository
                          </a>
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.5rem] border border-border/60 bg-background p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Batch progress
                        </p>
                        <p className="mt-2 text-3xl font-semibold">
                          {selectedRepository.analysis_progress || 0}%
                        </p>
                        <Progress
                          value={selectedRepository.analysis_progress || 0}
                          className="mt-3 h-2.5"
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {selectedRepository.analysis_current_stage ||
                            "Select contributors to start a new analysis batch."}
                        </p>
                      </div>

                      <div className="rounded-[1.5rem] border border-border/60 bg-background p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Queue telemetry
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-2xl font-semibold">
                              {selectedBatchState?.total ??
                                profilesWithContributorData.length}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Total in batch
                            </p>
                          </div>
                          <div>
                            <p className="text-2xl font-semibold">
                              {selectedBatchState?.failed.length ??
                                failedProfileCount}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Failed
                            </p>
                          </div>
                          <div>
                            <p className="text-2xl font-semibold">
                              {selectedBatchState?.processed.length ??
                                completedProfileCount}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Processed
                            </p>
                          </div>
                          <div>
                            <p className="text-2xl font-semibold">
                              {selectedBatchState?.queue.length ?? 0}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Still queued
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedBatchState?.activeContributor ? (
                      <div className="rounded-[1.5rem] border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm">
                        <p className="font-semibold text-cyan-800">
                          Active contributor
                        </p>
                        <p className="mt-1 text-cyan-700">
                          @{selectedBatchState.activeContributor} is currently
                          being analyzed.
                        </p>
                      </div>
                    ) : null}

                    {repositoryFailureReason ? (
                      <Alert className="border-destructive/40 bg-destructive/10">
                        <CircleAlert className="h-4 w-4" />
                        <AlertDescription className="text-destructive">
                          {repositoryFailureReason}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                    Sync repositories and select one to inspect its contributors
                    and analysis history.
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] xl:items-start">
              <Card className="min-w-0 border-border/60 bg-background/80 shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Repository explorer</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Filter repositories by name, language, or status instead
                        of scrolling through a long dropdown.
                      </p>
                    </div>
                    <Badge variant="outline" className="w-fit shrink-0">
                      {filteredRepositories.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={repoSearchQuery}
                      onChange={(event) =>
                        setRepoSearchQuery(event.target.value)
                      }
                      placeholder="Search repositories"
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Completed and failed repositories stay pinned above queued
                    work.
                  </p>

                  <ScrollArea className="h-[28rem]">
                    <div className="space-y-3 pr-4 sm:pr-5">
                      {filteredRepositories.map((repository) => {
                        const isSelected = repository.id === selectedRepoId;

                        return (
                          <button
                            key={repository.id}
                            type="button"
                            onClick={() => setSelectedRepoId(repository.id)}
                            className={cn(
                              "w-full rounded-[1.5rem] border p-4 text-left transition",
                              isSelected
                                ? "border-cyan-500/40 bg-cyan-500/10 shadow-sm"
                                : "border-border/60 bg-muted/15 hover:border-primary/30 hover:bg-muted/30",
                            )}
                          >
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/80">
                                      <Github className="h-4 w-4 text-muted-foreground" />
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-base font-semibold break-words [overflow-wrap:anywhere]">
                                        {repository.repo_name}
                                      </p>
                                      <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                        Repository
                                      </p>
                                    </div>
                                  </div>
                                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                                    {repository.repo_description ||
                                      "No repository description provided."}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "shrink-0 self-start",
                                    statusTone(repository.analysis_status),
                                  )}
                                >
                                  {getRepositoryStatusLabel(
                                    repository.analysis_status,
                                  )}
                                </Badge>
                              </div>

                              <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
                                <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                    Stack
                                  </p>
                                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium">
                                    <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="break-words [overflow-wrap:anywhere]">
                                      {repository.language || "Unknown"}
                                    </span>
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                    Progress
                                  </p>
                                  <p className="mt-1 text-sm font-medium">
                                    {repository.analysis_progress || 0}% done
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                    Stars
                                  </p>
                                  <p className="mt-1 text-sm font-medium">
                                    {typeof repository.stars === "number"
                                      ? repository.stars
                                      : 0}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                    Forks
                                  </p>
                                  <p className="mt-1 text-sm font-medium">
                                    {typeof repository.forks === "number"
                                      ? repository.forks
                                      : 0}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {filteredRepositories.length === 0 && (
                        <div className="rounded-[1.5rem] border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                          No repositories match this search yet.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
              <Card className="min-w-0 border-border/60 bg-background/80 shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>Contributors and batch control</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Pick the contributors whose commits should feed the
                        generated developer profiles.
                      </p>
                    </div>
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
                      className="gap-2 lg:min-w-[180px]"
                    >
                      {running ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Run analysis
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-sm">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={contributorSearchQuery}
                        onChange={(event) => {
                          setHasClearedContributorFocus(false);
                          setContributorSearchQuery(event.target.value);
                        }}
                        placeholder="Search contributors"
                        className="pl-10"
                        disabled={!selectedRepoId}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {contributorSearchQuery ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setHasClearedContributorFocus(true);
                            setContributorSearchQuery("");
                          }}
                        >
                          Show all contributors
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllVisibleContributors}
                        disabled={!filteredContributors.length}
                      >
                        Select visible
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearSelectedContributors}
                        disabled={!selectedContributors.length}
                      >
                        Clear selection
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[26rem] pr-3">
                    <div className="space-y-3">
                      {filteredContributors.map((contributor) => {
                        const checked = selectedContributors.includes(
                          contributor.login,
                        );
                        const profile =
                          profileByLogin.get(contributor.login) || null;
                        const failureReason =
                          profile?.status === "failed"
                            ? getProfileFailureReason(profile)
                            : null;

                        return (
                          <div
                            key={contributor.login}
                            className={cn(
                              "rounded-[1.5rem] border p-4 transition",
                              checked
                                ? "border-cyan-500/40 bg-cyan-500/10"
                                : "border-border/60 bg-muted/15 hover:border-primary/30 hover:bg-muted/30",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(nextChecked) =>
                                  toggleContributorSelection(
                                    contributor.login,
                                    Boolean(nextChecked),
                                  )
                                }
                                className="mt-1"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <Avatar className="h-11 w-11 border border-border/60">
                                      <AvatarImage
                                        src={getContributorAvatarUrl(
                                          contributor.login,
                                          contributor.avatar_url,
                                        )}
                                        alt={`${contributor.display_name} GitHub avatar`}
                                      />
                                      <AvatarFallback className="bg-primary/10 text-primary">
                                        {getInitials(contributor.display_name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold">
                                        @{contributor.display_name}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {contributor.contributions}{" "}
                                        contributions
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
                                      {getContributorStatusLabel(
                                        contributor.analysis_status,
                                      )}
                                    </Badge>
                                    {contributor.quality_score !== null && (
                                      <Badge variant="secondary">
                                        Score {contributor.quality_score}/10
                                      </Badge>
                                    )}
                                    {profile ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="gap-1"
                                        onClick={() =>
                                          setSelectedProfileId(
                                            profile.profileId,
                                          )
                                        }
                                      >
                                        View run
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>

                                <p className="mt-2 text-xs text-muted-foreground">
                                  Last profile update:{" "}
                                  {formatDateTime(contributor.last_analyzed_at)}
                                </p>

                                {failureReason ? (
                                  <p className="mt-2 text-xs text-destructive">
                                    Last failure: {failureReason}
                                  </p>
                                ) : contributor.top_weaknesses.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {contributor.top_weaknesses
                                      .slice(0, 3)
                                      .map((weakness) => (
                                        <Badge
                                          key={`${contributor.login}-${weakness.category}`}
                                          variant="outline"
                                        >
                                          {formatLabel(
                                            weakness.category ||
                                              "unknown_weakness",
                                          )}
                                        </Badge>
                                      ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {selectedRepoId && !filteredContributors.length && (
                        <div className="rounded-[1.5rem] border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                          No contributors match this filter.
                        </div>
                      )}

                      {!selectedRepoId && (
                        <div className="rounded-[1.5rem] border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                          Select a repository to load its contributor list.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
