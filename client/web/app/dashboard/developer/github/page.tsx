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
  ArrowLeft,
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
  last_analyzed_at: string | null;
  last_synced: string;
}

export default function GitHubPage() {
  const router = useRouter();
  const { user } = useAuthStore();
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

  useEffect(() => {
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

        const { data: reposData } = await api.get<Repository[]>(
          "/github/repositories",
        );
        setRepositories(reposData ?? []);
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
  }, [user, router]);

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

      const { data: reposData } = await api.get<Repository[]>(
        "/github/repositories",
      );
      setRepositories(reposData ?? []);
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
      const { data } = await api.post("/github/analyze", {
        repository_id: repositoryId,
      });

      setSuccess(`Analysis started for ${repoName}!`);
      setTimeout(() => setSuccess(""), 3000);

      // Update the repository status in the local state
      setRepositories((prevRepos) =>
        prevRepos.map((repo) =>
          repo.id === repositoryId
            ? { ...repo, analysis_status: "pending" }
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
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

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
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
                    <div className="flex items-center justify-between">
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
                            <ExternalLink className="w-4 h-4" />
                            Sync Repos
                          </>
                        )}
                      </Button>
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
                      <div className="space-y-3">
                        {repositories.map((repo) => (
                          <div
                            key={repo.id}
                            className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <a
                                    href={repo.repo_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-primary hover:underline"
                                  >
                                    {repo.repo_name}
                                  </a>
                                  {repo.analysis_status && (
                                    <Badge
                                      variant={
                                        repo.analysis_status === "completed"
                                          ? "default"
                                          : repo.analysis_status === "failed"
                                            ? "destructive"
                                            : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      {repo.analysis_status === "pending" &&
                                        "Pending"}
                                      {repo.analysis_status === "in_progress" &&
                                        "Analyzing"}
                                      {repo.analysis_status === "completed" &&
                                        "Analyzed"}
                                      {repo.analysis_status === "failed" &&
                                        "Failed"}
                                    </Badge>
                                  )}
                                </div>
                                {repo.repo_description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {repo.repo_description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-4 flex-wrap mt-3">
                              {repo.language && (
                                <Badge variant="outline" className="text-xs">
                                  {repo.language}
                                </Badge>
                              )}
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Star className="w-3 h-3" />
                                {repo.stars}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <GitFork className="w-3 h-3" />
                                {repo.forks}
                              </div>

                              <div className="ml-auto">
                                <Button
                                  size="sm"
                                  variant={
                                    repo.is_analyzed ? "outline" : "default"
                                  }
                                  onClick={() =>
                                    handleAnalyzeRepository(
                                      repo.id,
                                      repo.repo_name,
                                    )
                                  }
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
                                      Analyze with NLP
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>

                            {repo.last_analyzed_at && (
                              <div className="mt-2 pt-2 border-t border-border">
                                <p className="text-xs text-muted-foreground">
                                  Last analyzed:{" "}
                                  {new Date(
                                    repo.last_analyzed_at,
                                  ).toLocaleDateString()}{" "}
                                  at{" "}
                                  {new Date(
                                    repo.last_analyzed_at,
                                  ).toLocaleTimeString()}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Why Connect GitHub?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <h5 className="font-semibold text-sm">NLP Code Analysis</h5>
                  <p className="text-xs text-muted-foreground">
                    Use advanced NLP to analyze your code patterns, detect
                    skills, and identify expertise areas
                  </p>
                </div>
                <div className="space-y-2">
                  <h5 className="font-semibold text-sm">Automatic Analysis</h5>
                  <p className="text-xs text-muted-foreground">
                    SEO3 analyzes your code to identify technical skills and
                    expertise
                  </p>
                </div>
                <div className="space-y-2">
                  <h5 className="font-semibold text-sm">Skill Detection</h5>
                  <p className="text-xs text-muted-foreground">
                    Automatically detect languages and technologies you work
                    with
                  </p>
                </div>
                <div className="space-y-2">
                  <h5 className="font-semibold text-sm">Portfolio Showcase</h5>
                  <p className="text-xs text-muted-foreground">
                    Build your technical profile based on real contributions
                  </p>
                </div>
                <div className="space-y-2">
                  <h5 className="font-semibold text-sm">Team Insights</h5>
                  <p className="text-xs text-muted-foreground">
                    Help your tech lead understand team expertise distribution
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  {integration ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm">Connected</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-muted" />
                      <span className="text-sm text-muted-foreground">
                        Not Connected
                      </span>
                    </>
                  )}
                </div>

                {integration && (
                  <>
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-medium mb-1">Repositories</p>
                      <p className="text-lg font-bold">{repositories.length}</p>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-medium mb-1">
                        Connected Since
                      </p>
                      <p className="text-sm">
                        {new Date(
                          integration.connected_at,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
