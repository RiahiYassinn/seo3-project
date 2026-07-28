"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import {
  buildAdminWorkflowHref,
  readAdminWorkflowContext,
} from "@/lib/admin-workflow";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  GitBranch,
  Github,
  GitFork,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Unlink,
  Users,
} from "lucide-react";
import {
  formatLabel,
  getContributorAvatarUrl,
  getInitials,
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

/** Numbered heading that ties each page section back to the pipeline stage. */
function StageHeading({
  step,
  title,
  description,
  action,
}: {
  step: number;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/20">
          {step}
        </span>
        <div>
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

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
  const isAnalysisRunning =
    selectedRepository?.analysis_status === "pending" ||
    selectedRepository?.analysis_status === "in_progress";
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
          <AlertDescription className="text-emerald-700 dark:text-emerald-300">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : !integration ? (
        <Card className="mx-auto max-w-3xl overflow-hidden border-border/60 bg-background/80 shadow-sm">
          <div
            aria-hidden="true"
            className="h-1 w-full bg-gradient-to-r from-primary via-cyan-500 to-primary/20"
          />
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Github className="h-5 w-5" />
              </span>
              <div>
                <CardTitle>Link the admin GitHub account</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  This starts the pipeline: repositories sync first, then you
                  choose which contributors get analyzed.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleLinkGitHub}
              className="grid gap-4 md:grid-cols-2"
            >
              <div className="space-y-2">
                <label htmlFor="github-username" className="text-sm font-medium">
                  GitHub username
                </label>
                <Input
                  id="github-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="octocat"
                  disabled={linking}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="github-token" className="text-sm font-medium">
                  Personal access token
                </label>
                <Input
                  id="github-token"
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

          {/* --------------------------- Context bar --------------------------- */}
          <Card className="mb-8 border-border/60 bg-background/80 shadow-sm">
            <CardContent className="grid gap-px overflow-hidden bg-border/60 p-0 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex items-center gap-3 bg-background/95 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Github className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Connected account
                  </p>
                  <p className="truncate text-sm font-semibold">
                    @{integration.github_username}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-background/95 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <GitBranch className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Repositories</p>
                  <p className="text-sm font-semibold">
                    {repositories.length}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {filteredRepositories.length} shown
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-background/95 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Users className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Contributors</p>
                  <p className="text-sm font-semibold">
                    {selectedRepository ? contributors.length : "--"}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {selectedContributorCount} selected
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-background/95 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Profiles built</p>
                  <p className="text-sm font-semibold">
                    {selectedRepository
                      ? profilesWithContributorData.length
                      : "--"}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {completedProfileCount} ok, {failedProfileCount} failed
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ----------------------- Stage 1: repository ----------------------- */}
          <section className="mb-10">
            <StageHeading
              step={1}
              title="Choose a repository"
              description="Pick the repository whose contributors you want to analyze."
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
              <Card className="min-w-0 border-border/60 bg-background/80 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base">
                      Repository explorer
                    </CardTitle>
                    <Badge variant="outline" className="w-fit shrink-0">
                      {filteredRepositories.length} of {repositories.length}
                    </Badge>
                  </div>
                  <div className="relative pt-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={repoSearchQuery}
                      onChange={(event) =>
                        setRepoSearchQuery(event.target.value)
                      }
                      placeholder="Search by name, language, or status"
                      className="pl-10"
                      aria-label="Search repositories"
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[30rem]">
                    <div className="space-y-2 pr-3">
                      {filteredRepositories.map((repository) => {
                        const isSelected = repository.id === selectedRepoId;
                        const progress = repository.analysis_progress || 0;
                        const isRunning =
                          repository.analysis_status === "in_progress" ||
                          repository.analysis_status === "pending";

                        return (
                          <button
                            key={repository.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSelectedRepoId(repository.id)}
                            className={cn(
                              "w-full rounded-xl border p-4 text-left transition-all",
                              isSelected
                                ? "border-primary/45 bg-primary/[0.06] shadow-sm ring-1 ring-primary/15"
                                : "border-border/60 bg-muted/10 hover:border-primary/30 hover:bg-muted/25",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-2.5">
                                <span
                                  className={cn(
                                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                    isSelected
                                      ? "bg-primary/15 text-primary"
                                      : "bg-background text-muted-foreground ring-1 ring-border/60",
                                  )}
                                >
                                  <Github className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">
                                    {repository.repo_name}
                                  </p>
                                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                    {repository.repo_description ||
                                      "No description provided."}
                                  </p>
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "shrink-0 text-[11px]",
                                  statusTone(repository.analysis_status),
                                )}
                              >
                                {getRepositoryStatusLabel(
                                  repository.analysis_status,
                                )}
                              </Badge>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-[2.625rem] text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <GitBranch className="h-3.5 w-3.5" />
                                {repository.language || "Unknown"}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <Star className="h-3.5 w-3.5" />
                                {typeof repository.stars === "number"
                                  ? repository.stars
                                  : 0}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <GitFork className="h-3.5 w-3.5" />
                                {typeof repository.forks === "number"
                                  ? repository.forks
                                  : 0}
                              </span>
                            </div>

                            {isRunning || progress > 0 ? (
                              <div className="mt-3 pl-[2.625rem]">
                                <Progress value={progress} className="h-1.5" />
                                <p className="mt-1.5 text-[11px] text-muted-foreground">
                                  {progress}% analyzed
                                </p>
                              </div>
                            ) : null}
                          </button>
                        );
                      })}

                      {filteredRepositories.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
                          <p className="text-sm font-medium">
                            No repositories match this search
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Try another term, or sync repositories again.
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="min-w-0 border-border/60 bg-background/80 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">
                    Selected repository
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedRepository ? (
                    <>
                      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words text-lg font-semibold [overflow-wrap:anywhere]">
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

                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-2"
                        >
                          <a
                            href={selectedRepository.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open
                          </a>
                        </Button>
                      </div>

                      <div className="rounded-xl border border-border/60 bg-background p-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Batch progress
                          </p>
                          <p className="text-2xl font-semibold tabular-nums">
                            {selectedRepository.analysis_progress || 0}%
                          </p>
                        </div>
                        <Progress
                          value={selectedRepository.analysis_progress || 0}
                          className="mt-3 h-2"
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {selectedRepository.analysis_current_stage ||
                            "Select contributors below to start a new batch."}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          {
                            label: "In batch",
                            value:
                              selectedBatchState?.total ??
                              profilesWithContributorData.length,
                            tone: "text-foreground",
                          },
                          {
                            label: "Processed",
                            value:
                              selectedBatchState?.processed.length ??
                              completedProfileCount,
                            tone: "text-emerald-600 dark:text-emerald-400",
                          },
                          {
                            label: "Queued",
                            value: selectedBatchState?.queue.length ?? 0,
                            tone: "text-foreground",
                          },
                          {
                            label: "Failed",
                            value:
                              selectedBatchState?.failed.length ??
                              failedProfileCount,
                            tone: "text-destructive",
                          },
                        ].map((tile) => (
                          <div
                            key={tile.label}
                            className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5"
                          >
                            <p
                              className={cn(
                                "text-xl font-semibold tabular-nums",
                                tile.tone,
                              )}
                            >
                              {tile.value}
                            </p>
                            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                              {tile.label}
                            </p>
                          </div>
                        ))}
                      </div>

                      {selectedBatchState?.activeContributor ? (
                        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-600 dark:text-cyan-400" />
                          <div className="min-w-0 text-sm">
                            <p className="font-semibold text-cyan-800 dark:text-cyan-200">
                              Analyzing @{selectedBatchState.activeContributor}
                            </p>
                            <p className="mt-0.5 text-xs text-cyan-700/90 dark:text-cyan-300/90">
                              This page refreshes itself every few seconds.
                            </p>
                          </div>
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
                    <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <GitBranch className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-medium">
                        No repository selected
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sync repositories, then pick one on the left to see its
                        analysis history.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ---------------------- Stage 2: contributors ---------------------- */}
          <section>
            <StageHeading
              step={2}
              title="Select contributors and run the analysis"
              description="Their commits and reviews become the generated developer profiles."
              action={
                <Button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={
                    running ||
                    !selectedRepoId ||
                    selectedContributors.length === 0 ||
                    isAnalysisRunning
                  }
                  className="gap-2 sm:min-w-[15rem]"
                >
                  {running || isAnalysisRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isAnalysisRunning
                    ? "Analysis in progress"
                    : selectedContributorCount > 0
                      ? `Run analysis on ${selectedContributorCount} contributor${
                          selectedContributorCount === 1 ? "" : "s"
                        }`
                      : "Run analysis"}
                </Button>
              }
            />

            <Card className="border-border/60 bg-background/80 shadow-sm">
              <CardHeader className="pb-4">
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
                      aria-label="Search contributors"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedContributorCount > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        {selectedContributorCount} selected
                      </Badge>
                    ) : null}
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
                        Show all
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
                      Clear
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {repositoryContextLoading && !contributors.length ? (
                  <div className="flex min-h-[16rem] items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading contributors
                  </div>
                ) : (
                  <ScrollArea className="h-[32rem]">
                    <div className="grid gap-3 pr-3 sm:grid-cols-2 2xl:grid-cols-3">
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
                            role="checkbox"
                            tabIndex={0}
                            aria-checked={checked}
                            onClick={() =>
                              toggleContributorSelection(contributor.login)
                            }
                            onKeyDown={(event) => {
                              if (event.key === " " || event.key === "Enter") {
                                event.preventDefault();
                                toggleContributorSelection(contributor.login);
                              }
                            }}
                            className={cn(
                              "cursor-pointer rounded-xl border p-4 outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              checked
                                ? "border-primary/45 bg-primary/[0.06] shadow-sm ring-1 ring-primary/15"
                                : "border-border/60 bg-muted/10 hover:border-primary/30 hover:bg-muted/25",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={checked}
                                aria-hidden="true"
                                tabIndex={-1}
                                className="pointer-events-none mt-1"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-3">
                                  <Avatar className="h-10 w-10 border border-border/60">
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
                                    <p className="truncate text-sm font-semibold">
                                      {contributor.display_name}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      @{contributor.login} ·{" "}
                                      {contributor.contributions} commits
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[11px]",
                                      statusTone(contributor.analysis_status),
                                    )}
                                  >
                                    {getContributorStatusLabel(
                                      contributor.analysis_status,
                                    )}
                                  </Badge>
                                  {contributor.quality_score !== null && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[11px]"
                                    >
                                      Score {contributor.quality_score}/10
                                    </Badge>
                                  )}
                                </div>

                                {failureReason ? (
                                  <p className="mt-2.5 line-clamp-2 text-xs text-destructive">
                                    Last failure: {failureReason}
                                  </p>
                                ) : contributor.top_weaknesses.length ? (
                                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                                    {contributor.top_weaknesses
                                      .slice(0, 2)
                                      .map((weakness) => (
                                        <Badge
                                          key={`${contributor.login}-${weakness.category}`}
                                          variant="outline"
                                          className="text-[11px] font-normal"
                                        >
                                          {formatLabel(
                                            weakness.category ||
                                              "unknown_weakness",
                                          )}
                                        </Badge>
                                      ))}
                                  </div>
                                ) : null}

                                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {contributor.last_analyzed_at
                                      ? `Updated ${formatDateTime(contributor.last_analyzed_at)}`
                                      : "Never analyzed"}
                                  </p>
                                  {profile ? (
                                    <Button
                                      asChild
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 shrink-0 gap-1 px-2 text-xs"
                                    >
                                      <Link
                                        href={buildAdminWorkflowHref(
                                          "/dashboard/admin/profiles",
                                          {
                                            repoId: selectedRepoId,
                                            contributorLogin:
                                              contributor.login,
                                            profileId: profile.profileId,
                                          },
                                        )}
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                      >
                                        Open profile
                                        <ArrowUpRight className="h-3 w-3" />
                                      </Link>
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {selectedRepoId && !filteredContributors.length && (
                        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center sm:col-span-2 2xl:col-span-3">
                          <p className="text-sm font-medium">
                            No contributors match this filter
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Clear the search to see everyone in this repository.
                          </p>
                        </div>
                      )}

                      {!selectedRepoId && (
                        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center sm:col-span-2 2xl:col-span-3">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                            <Users className="h-5 w-5" />
                          </div>
                          <p className="mt-3 text-sm font-medium">
                            Finish stage 1 first
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Select a repository above to load its contributor
                            list.
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </AdminShell>
  );
}
