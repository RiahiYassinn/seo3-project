"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api from "@/lib/api";
import {
  Zap,
  TrendingUp,
  Users,
  GitBranch,
  Brain,
  Target,
  Star,
  Plus,
  User as UserIcon,
  Github,
  Link as LinkIcon,
  Unlink,
  ExternalLink,
  GitFork,
  Code,
  Loader,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  LayoutDashboard,
  UserCircle,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";

const proficiencyColors = {
  beginner: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  intermediate:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  advanced:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  expert: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const proficiencyIcons = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

// Mock data — replace with real API calls when backend is ready
const MOCK_SKILLS = [
  {
    id: "s1",
    skill_name: "React",
    proficiency_level: "expert",
    endorsements: 10,
  },
  {
    id: "s2",
    skill_name: "TypeScript",
    proficiency_level: "advanced",
    endorsements: 8,
  },
  {
    id: "s3",
    skill_name: "Node.js",
    proficiency_level: "intermediate",
    endorsements: 5,
  },
  {
    id: "s4",
    skill_name: "CSS",
    proficiency_level: "beginner",
    endorsements: 3,
  },
];

const MOCK_TEAM = {
  id: "team1",
  name: "Alpha Team",
  description: "We build awesome apps together",
  members: [
    { id: "1", name: "Alice Johnson", role: "Senior Developer" },
    { id: "2", name: "Bob Smith", role: "Backend Developer" },
    { id: "3", name: "Carol Lee", role: "Frontend Developer" },
  ],
};

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
  last_synced: string;
}

export default function DeveloperDashboard() {
  const { user, hasHydrated } = useAuthStore();
  const router = useRouter();

  // GitHub integration state
  const [integration, setIntegration] = useState<GitHubIntegration | null>(
    null,
  );
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loadingGitHub, setLoadingGitHub] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "developer") {
      router.replace("/dashboard");
    }
  }, [user, hasHydrated, router]);

  // Fetch GitHub integration data
  useEffect(() => {
    if (!user) return;

    const fetchGitHubData = async () => {
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
          console.error("Failed to load GitHub integration:", err);
        }
      } finally {
        setLoadingGitHub(false);
      }
    };

    fetchGitHubData();
  }, [user]);

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

  if (!hasHydrated || !user)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const skills = MOCK_SKILLS;
  const team = MOCK_TEAM;

  const totalSkills = skills.length;
  const totalEndorsements = skills.reduce((sum, s) => sum + s.endorsements, 0);
  const expertSkills = skills.filter(
    (s) => s.proficiency_level === "expert",
  ).length;
  const proficiencyPct =
    totalSkills > 0 ? Math.round((expertSkills / totalSkills) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold mb-1">Developer Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {fullName}</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 h-auto">
            <TabsTrigger value="overview" className="gap-2 py-3">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="github" className="gap-2 py-3">
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2 py-3">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2 py-3">
              <UserCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Skills
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{totalSkills}</span>
                  <Target className="w-8 h-8 text-primary opacity-50" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Endorsements
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{totalEndorsements}</span>
                  <Star className="w-8 h-8 text-secondary opacity-50" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Expert Skills
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{expertSkills}</span>
                  <Zap className="w-8 h-8 text-accent opacity-50" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Proficiency
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{proficiencyPct}%</span>
                  <TrendingUp className="w-8 h-8 text-primary opacity-50" />
                </CardContent>
              </Card>
            </div>

            {/* Skills Section */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Your Skills</CardTitle>
                        <CardDescription>
                          Track and showcase your technical expertise
                        </CardDescription>
                      </div>
                      <Button size="sm" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Skill
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {skills.length === 0 ? (
                      <div className="text-center py-12">
                        <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">
                          No skills added yet
                        </p>
                        <Button variant="outline" size="sm">
                          Add your first skill
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {skills.map((skill) => (
                          <div
                            key={skill.id}
                            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold text-lg">
                                  {skill.skill_name}
                                </h4>
                                <Badge
                                  variant="secondary"
                                  className={
                                    proficiencyColors[
                                      skill.proficiency_level as keyof typeof proficiencyColors
                                    ]
                                  }
                                >
                                  {skill.proficiency_level}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                {Array.from({
                                  length:
                                    proficiencyIcons[
                                      skill.proficiency_level as keyof typeof proficiencyIcons
                                    ],
                                }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className="w-4 h-4 fill-secondary text-secondary"
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">
                                {skill.endorsements}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                endorsements
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitBranch className="w-5 h-5" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm font-medium mb-1">
                        Master Advanced Skills
                      </p>
                      <p className="text-xs text-muted-foreground">
                        You have strong fundamentals. Consider deepening your
                        expertise.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/20">
                      <p className="text-sm font-medium mb-1">
                        Share Knowledge
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Help teammates grow by mentoring on your expert areas.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                      <p className="text-sm font-medium mb-1">
                        Connect GitHub
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Link your GitHub account to auto-detect skills from
                        your projects.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* GitHub Tab */}
          <TabsContent value="github" className="space-y-6">
            {error && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-600">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {!integration ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <LinkIcon className="w-5 h-5" />
                        Link Your GitHub Account
                      </CardTitle>
                      <CardDescription>
                        Connect your GitHub account to import your repositories
                        and analyze your code
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

                      <div className="mt-6 p-4 bg-muted rounded-lg border">
                        <h4 className="font-semibold text-sm mb-2">
                          How to create a token:
                        </h4>
                        <ol className="text-sm text-muted-foreground space-y-1">
                          <li>
                            1. Go to GitHub Settings → Developer settings →
                            Personal access tokens
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
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20">
                              <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                              <CardTitle>GitHub Connected</CardTitle>
                              <CardDescription>
                                Connected to @{integration.github_username}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push("/dashboard/developer/github")}
                              className="gap-2"
                            >
                              <Brain className="w-4 h-4" />
                              NLP Analysis
                            </Button>
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
                              {syncing
                                ? "Syncing..."
                                : "Sync Your Repositories"}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {repositories.map((repo) => (
                              <a
                                key={repo.id}
                                href={repo.repo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors hover:border-primary/50"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-primary hover:underline">
                                      {repo.repo_name}
                                    </h4>
                                    {repo.repo_description && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {repo.repo_description}
                                      </p>
                                    )}
                                  </div>
                                  <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
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
                                </div>
                              </a>
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
                    <CardTitle className="text-lg">
                      Why Connect GitHub?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">
                        Automatic Analysis
                      </h5>
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
                      <h5 className="font-semibold text-sm">
                        Portfolio Showcase
                      </h5>
                      <p className="text-xs text-muted-foreground">
                        Build your technical profile based on real contributions
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Team Insights</h5>
                      <p className="text-xs text-muted-foreground">
                        Help your tech lead understand team expertise
                        distribution
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
                          <span className="text-sm font-medium">Connected</span>
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
                          <p className="text-xs font-medium mb-1">
                            Repositories
                          </p>
                          <p className="text-lg font-bold">
                            {repositories.length}
                          </p>
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
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {team.name}
                </CardTitle>
                <CardDescription>{team.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                        <UserIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{member.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {member.role}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        View Profile
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Manage your profile details and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-2">
                        First Name
                      </label>
                      <Input value={user.first_name} disabled />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-2">
                        Last Name
                      </label>
                      <Input value={user.last_name} disabled />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Email Address
                    </label>
                    <Input value={user.email} disabled />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Username
                    </label>
                    <Input value={user.username} disabled />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Role
                    </label>
                    <Badge variant="outline" className="capitalize">
                      {user.role}
                    </Badge>
                  </div>

                  <div className="pt-4 border-t">
                    <Button>Update Profile</Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Account Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      Change Password
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Notification Settings
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Privacy Settings
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
