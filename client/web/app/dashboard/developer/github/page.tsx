"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Github,
  Link as LinkIcon,
  Unlink,
  ExternalLink,
  Star,
  GitFork,
  Code,
  Loader,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  Search,
  RefreshCw,
  Clock3,
  FolderGit2,
  DatabaseZap,
} from "lucide-react";

interface GitHubIntegration {
  id: string;
  github_username: string;
  connected_at: string;
}

interface Repository {
  id: string;
  repo_name: string;
  repo_url: string;
  repo_description: string;
  language: string;
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

type RepositoryFilter = "all" | "analyzed" | "queued";

export default function GitHubPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const [integration, setIntegration] = useState<GitHubIntegration | null>(
    null,
  );
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null); // Track which repo is being analyzed
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [repositoryFilter, setRepositoryFilter] =
    useState<RepositoryFilter>("all");

  const loadRepositories = async () => {
    const { data: reposData } = await api.get<Repository[]>(
      "/github/repositories",
    );
    setRepositories(reposData ?? []);
    return reposData ?? [];
  };

  useEffect(() => {
    // Wait for auth state to rehydrate from localStorage
    if (!hasHydrated) return;

    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "developer") {
      router.replace("/dashboard/tech_lead");
      return;
    }

    const fetchData = async () => {
      try {
        const { data: integrationData } = await api.get<GitHubIntegration>(
          "/github/integration",
        );
        setIntegration(integrationData);
        setUsername(integrationData.github_username);
        await loadRepositories();
      } catch (err: any) {
        // 404 means no integration yet — not an error worth surfacing
        if (err?.response?.status !== 404) {
          setError(
            err?.response?.data?.message ??
              err.message ??
              "Failed to load integration",
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, router, hasHydrated]);

  useEffect(() => {
    if (!integration) return;

    const hasActiveAnalysis = repositories.some(
      (repo) =>
        repo.analysis_status === "pending" ||
        repo.analysis_status === "in_progress",
    );

    if (!hasActiveAnalysis) return;

    const interval = window.setInterval(() => {
      loadRepositories().catch(() => {
        // Keep the current UI state if polling fails temporarily.
      });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [integration, repositories]);

  const handleLinkGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLinking(true);

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
      setSuccess("GitHub account linked successfully!");
      setTimeout(() => setSuccess(""), 3000);
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
    if (!integration) return;
    setSyncing(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/github/sync", {
        integrationId: integration.id,
        username: integration.github_username,
      });

      await loadRepositories();
      setSuccess("Repositories synced successfully!");
      setTimeout(() => setSuccess(""), 3000);
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
    if (!integration) return;
    if (
      !confirm(
        "Are you sure you want to unlink your GitHub account? This will remove all synced repositories.",
      )
    )
      return;

    setUnlinking(true);
    setError("");

    try {
      await api.delete("/github/integration");
      setIntegration(null);
      setRepositories([]);
      setSuccess("GitHub account unlinked successfully!");
      setTimeout(() => setSuccess(""), 3000);
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

  const handleAnalyzeRepository = async (
    repositoryId: string,
    repoName: string,
  ) => {
    setAnalyzing(repositoryId);
    setError("");
    setSuccess("");

    try {
      await api.post("/github/analyze", {
        repository_id: repositoryId,
      });

      setSuccess(`Analysis started for ${repoName}!`);
      setTimeout(() => setSuccess(""), 3000);

      // Update the repository status in the local state
      setRepositories((prevRepos) =>
        prevRepos.map((repo) =>
          repo.id === repositoryId
            ? {
                ...repo,
                analysis_status: "pending",
                analysis_progress: 5,
                analysis_current_stage: "Queued for analysis",
              }
            : repo,
        ),
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err.message ??
          `Failed to start analysis for ${repoName}`,
      );
    } finally {
      setAnalyzing(null);
    }
  };

  const analyzedRepositoryList = repositories.filter(
    (repo) => repo.analysis_status === "completed" || repo.is_analyzed,
  );
  const queuedRepositoryList = repositories.filter(
    (repo) =>
      repo.analysis_status === "pending" ||
      repo.analysis_status === "in_progress",
  );
  const filteredRepositories = repositories.filter((repo) => {
    const matchesSearch = repo.repo_name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (repositoryFilter === "analyzed") {
      return repo.analysis_status === "completed" || repo.is_analyzed;
    }

    if (repositoryFilter === "queued") {
      return (
        repo.analysis_status === "pending" ||
        repo.analysis_status === "in_progress"
      );
    }

    return true;
  });
  const analyzedRepositories = analyzedRepositoryList.length;
  const pendingRepositories = queuedRepositoryList.length;
  const totalStars = repositories.reduce((sum, repo) => sum + repo.stars, 0);
  const activeAnalyses = queuedRepositoryList;

  const formatDateTime = (value: string | null) => {
    if (!value) return "Not available";
    return new Date(value).toLocaleString();
  };

  const getAnalysisTone = (status: string | null, isAnalyzed: boolean) => {
    if (status === "completed" || isAnalyzed) {
      return "bg-green-500/10 text-green-700 border-green-500/20";
    }
    if (status === "failed") {
      return "bg-red-500/10 text-red-700 border-red-500/20";
    }
    if (status === "pending" || status === "in_progress") {
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    }
    return "bg-muted text-muted-foreground border-border";
  };

  const getAnalysisLabel = (status: string | null, isAnalyzed: boolean) => {
    if (status === "completed" || isAnalyzed) return "Analyzed";
    if (status === "failed") return "Failed";
    if (status === "pending") return "Pending";
    if (status === "in_progress") return "In Progress";
    return "Not analyzed";
  };

  const getRepositoryFilterLabel = (filter: RepositoryFilter) => {
    if (filter === "analyzed") return "Analyzed";
    if (filter === "queued") return "In Queue";
    return "Repositories";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">
              Loading GitHub integration...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          {/* <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button> */}
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Github className="w-8 h-8" />
            GitHub Integration
          </h1>
          <p className="text-muted-foreground">
            Link your GitHub account to access and analyze your repositories
          </p>
        </div>

        {error && (
          <Alert className="mb-6 border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-500/50 bg-green-500/10">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {!integration ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                Link Your GitHub Account
              </CardTitle>
              <CardDescription>
                Connect your GitHub account to import your repositories and
                analyze your code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLinkGitHub} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    GitHub Username
                  </label>
                  <Input
                    placeholder="your-github-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={linking}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Your GitHub username (e.g., octocat)
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Personal Access Token
                  </label>
                  <Input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={linking}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a token at{" "}
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      GitHub Settings
                    </a>{" "}
                    with <code>repo</code> and <code>read:user</code>{" "}
                    permissions
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={linking || !username || !token}
                >
                  {linking ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <Github className="w-4 h-4" />
                      Link GitHub Account
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold text-sm mb-2">
                  How to create a token:
                </h4>
                <ol className="text-sm text-muted-foreground space-y-1">
                  <li>
                    1. Go to GitHub Settings → Developer settings → Personal
                    access tokens
                  </li>
                  <li>2. Click "Generate new token (classic)"</li>
                  <li>3. Add a note like "SEO3 Integration"</li>
                  <li>
                    4. Select scopes: <strong>repo</strong> and{" "}
                    <strong>read:user</strong>
                  </li>
                  <li>5. Click Generate and copy the token</li>
                  <li>6. Paste it above and click Link</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6 border-green-500/20 bg-green-500/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle>GitHub Connected</CardTitle>
                      <CardDescription>
                        Connected to @{integration.github_username}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleUnlinkGitHub}
                    disabled={unlinking}
                    className="gap-2"
                  >
                    {unlinking ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Unlinking...
                      </>
                    ) : (
                      <>
                        <Unlink className="w-4 h-4" />
                        Unlink
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="w-5 h-5" />
                      Your Repositories ({repositories.length})
                    </CardTitle>
                    <CardDescription>
                      Last synced:{" "}
                      {repositories.length > 0
                        ? new Date(
                            repositories[0]?.last_synced ?? Date.now(),
                          ).toLocaleDateString()
                        : "Never"}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative min-w-[240px] flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search repositories by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button
                      onClick={handleSyncRepositories}
                      disabled={syncing}
                      className="gap-2"
                    >
                      {syncing ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Sync Repos
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {repositories.length === 0 ? (
                  <div className="text-center py-12">
                    <Code className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      No repositories found
                    </p>
                    <Button
                      onClick={handleSyncRepositories}
                      disabled={syncing}
                      variant="outline"
                      className="gap-2"
                    >
                      {syncing ? "Syncing..." : "Sync Your Repositories"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
                      <button
                        type="button"
                        onClick={() => setRepositoryFilter("all")}
                        className={`rounded-2xl border bg-background p-4 text-left transition hover:border-primary/40 ${
                          repositoryFilter === "all"
                            ? "border-primary shadow-sm"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Repositories
                          </span>
                          <FolderGit2 className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-3xl font-semibold">
                          {repositories.length}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Total synced from GitHub
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRepositoryFilter("analyzed")}
                        className={`rounded-2xl border bg-background p-4 text-left transition hover:border-primary/40 ${
                          repositoryFilter === "analyzed"
                            ? "border-primary shadow-sm"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Analyzed
                          </span>
                          <DatabaseZap className="h-4 w-4 text-green-600" />
                        </div>
                        <p className="text-3xl font-semibold">
                          {analyzedRepositories}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Repositories with completed analysis
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRepositoryFilter("queued")}
                        className={`rounded-2xl border bg-background p-4 text-left transition hover:border-primary/40 ${
                          repositoryFilter === "queued"
                            ? "border-primary shadow-sm"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            In Queue
                          </span>
                          <Clock3 className="h-4 w-4 text-amber-600" />
                        </div>
                        <p className="text-3xl font-semibold">
                          {pendingRepositories}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Pending or running analyses
                        </p>
                      </button>
                      <div className="rounded-2xl border bg-background p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Total Stars
                          </span>
                          <Star className="h-4 w-4 text-yellow-500" />
                        </div>
                        <p className="text-3xl font-semibold">{totalStars}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Combined public traction across repos
                        </p>
                      </div>
                    </div>

                    {filteredRepositories.length === 0 ? (
                      <div className="text-center py-12">
                        <Code className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">
                          No repositories match your current filters
                        </p>
                        <div className="flex justify-center gap-3">
                          {searchQuery && (
                            <Button
                              onClick={() => setSearchQuery("")}
                              variant="outline"
                              size="sm"
                            >
                              Clear Search
                            </Button>
                          )}
                          {repositoryFilter !== "all" && (
                            <Button
                              onClick={() => setRepositoryFilter("all")}
                              variant="outline"
                              size="sm"
                            >
                              Show All Repositories
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {activeAnalyses.length > 0 && (
                          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="text-sm font-semibold">
                                  Repository analysis in progress
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Track live progress here or open a repository
                                  for deeper details.
                                </p>
                              </div>
                              <div className="w-full max-w-xl space-y-3">
                                {activeAnalyses.slice(0, 2).map((repo) => (
                                  <button
                                    key={repo.id}
                                    type="button"
                                    onClick={() =>
                                      router.push(
                                        `/dashboard/developer/github/${repo.id}`,
                                      )
                                    }
                                    className="w-full rounded-xl border bg-background px-4 py-3 text-left transition hover:border-primary/40"
                                  >
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <span className="font-medium">
                                        {repo.repo_name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {repo.analysis_progress ?? 0}%
                                      </span>
                                    </div>
                                    <Progress
                                      value={repo.analysis_progress ?? 0}
                                      className="h-2"
                                    />
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {repo.analysis_current_stage ||
                                        "Analysis in progress"}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="mb-4 flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">
                              {filteredRepositories.length} repositories visible
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Scan analysis status, sync freshness, and repo
                              health at a glance
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {repositoryFilter !== "all" && (
                              <Badge variant="outline">
                                Status:{" "}
                                {getRepositoryFilterLabel(repositoryFilter)}
                              </Badge>
                            )}
                            {searchQuery && (
                              <Badge variant="outline">
                                Search: {searchQuery}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                          {filteredRepositories.map((repo) => (
                            <Card
                              key={repo.id}
                              onClick={() =>
                                router.push(
                                  `/dashboard/developer/github/${repo.id}`,
                                )
                              }
                              className="h-full cursor-pointer border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
                            >
                              <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      <Badge
                                        variant="outline"
                                        className={getAnalysisTone(
                                          repo.analysis_status,
                                          repo.is_analyzed,
                                        )}
                                      >
                                        {getAnalysisLabel(
                                          repo.analysis_status,
                                          repo.is_analyzed,
                                        )}
                                      </Badge>
                                      {repo.language && (
                                        <Badge variant="secondary">
                                          {repo.language}
                                        </Badge>
                                      )}
                                    </div>
                                    <a
                                      href={repo.repo_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                      className="inline-flex items-center gap-2 text-lg font-semibold text-primary hover:underline"
                                    >
                                      {repo.repo_name}
                                      <ExternalLink className="h-4 w-4 opacity-70" />
                                    </a>
                                    <p className="mt-2 min-h-[3rem] text-sm leading-6 text-muted-foreground">
                                      {repo.repo_description ||
                                        "No description provided for this repository yet."}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                  <div className="rounded-xl border bg-muted/20 p-3">
                                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                      <Star className="w-3 h-3" />
                                      Stars
                                    </div>
                                    <p className="text-lg font-semibold">
                                      {repo.stars}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border bg-muted/20 p-3">
                                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                      <GitFork className="w-3 h-3" />
                                      Forks
                                    </div>
                                    <p className="text-lg font-semibold">
                                      {repo.forks}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid gap-3 text-sm mb-5">
                                  <div className="rounded-xl border border-border/70 px-3 py-3">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <span className="text-muted-foreground">
                                        Analysis progress
                                      </span>
                                      <span className="text-right font-medium">
                                        {repo.analysis_progress ?? 0}%
                                      </span>
                                    </div>
                                    <Progress
                                      value={repo.analysis_progress ?? 0}
                                      className="h-2"
                                    />
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {repo.analysis_current_stage ||
                                        (repo.analysis_status === "completed"
                                          ? "Analysis completed"
                                          : "Waiting to be analyzed")}
                                    </p>
                                  </div>
                                  <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 px-3 py-2">
                                    <span className="text-muted-foreground">
                                      Last synced
                                    </span>
                                    <span className="text-right font-medium">
                                      {formatDateTime(repo.last_synced)}
                                    </span>
                                  </div>
                                  <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 px-3 py-2">
                                    <span className="text-muted-foreground">
                                      Last analyzed
                                    </span>
                                    <span className="text-right font-medium">
                                      {repo.last_analyzed_at
                                        ? formatDateTime(repo.last_analyzed_at)
                                        : "Not analyzed yet"}
                                    </span>
                                  </div>
                                  <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 px-3 py-2">
                                    <span className="text-muted-foreground">
                                      Analysis readiness
                                    </span>
                                    <span className="text-right font-medium">
                                      {repo.analysis_status === "pending" ||
                                      repo.analysis_status === "in_progress"
                                        ? "Currently processing"
                                        : repo.is_analyzed
                                          ? "Ready for re-analysis"
                                          : "Ready to analyze"}
                                    </span>
                                  </div>
                                </div>

                                {repo.analysis_summary && (
                                  <div className="mb-5 grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border bg-green-500/5 p-3">
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Quality Score
                                      </p>
                                      <p className="text-xl font-semibold">
                                        {repo.analysis_summary.quality_score ??
                                          "--"}
                                        /10
                                      </p>
                                    </div>
                                    <div className="rounded-xl border bg-primary/5 p-3">
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Skill Level
                                      </p>
                                      <p className="text-xl font-semibold capitalize">
                                        {repo.analysis_summary.skill_level ??
                                          "--"}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {repo.analysis_summary?.top_weaknesses?.[0] && (
                                  <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                      Top Weakness
                                    </p>
                                    <div className="mt-1 flex items-center justify-between gap-3">
                                      <p className="font-medium capitalize">
                                        {repo.analysis_summary.top_weaknesses[0].category.replace(
                                          /_/g,
                                          " ",
                                        )}
                                      </p>
                                      <Badge variant="outline" className="capitalize">
                                        {repo.analysis_summary.top_weaknesses[0].priority}
                                      </Badge>
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs text-muted-foreground">
                                    Repo ID:{" "}
                                    <span className="font-mono">
                                      {repo.id.slice(0, 8)}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant={
                                      repo.is_analyzed ? "outline" : "default"
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleAnalyzeRepository(
                                        repo.id,
                                        repo.repo_name,
                                      );
                                    }}
                                    disabled={
                                      analyzing === repo.id ||
                                      repo.analysis_status === "pending" ||
                                      repo.analysis_status === "in_progress"
                                    }
                                    className="gap-2"
                                  >
                                    {analyzing === repo.id ? (
                                      <>
                                        <Loader className="w-3 h-3 animate-spin" />
                                        Starting...
                                      </>
                                    ) : repo.is_analyzed ? (
                                      <>
                                        <CheckCircle className="w-3 h-3" />
                                        Re-analyze
                                      </>
                                    ) : (
                                      <>
                                        <Code className="w-3 h-3" />
                                        Analyze
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
