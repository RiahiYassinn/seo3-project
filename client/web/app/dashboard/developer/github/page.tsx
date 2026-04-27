"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CircleAlert,
  Github,
  Link as LinkIcon,
  Loader2,
  Sparkles,
  Unlink,
} from "lucide-react";

interface GitHubIntegration {
  id: string;
  github_username: string;
  connected_at: string;
}

export default function DeveloperGithubPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [integration, setIntegration] = useState<GitHubIntegration | null>(
    null,
  );
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
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
      return;
    }

    const loadIntegration = async () => {
      try {
        const { data } = await api.get<GitHubIntegration>(
          "/github/integration",
        );
        setIntegration(data);
        setUsername(data.github_username);
      } catch (requestError: any) {
        if (requestError?.response?.status !== 404) {
          setError(
            requestError?.response?.data?.message ||
              requestError?.message ||
              "Failed to load GitHub integration",
          );
        }
      } finally {
        setLoading(false);
      }
    };

    loadIntegration();
  }, [hasHydrated, router, user]);

  const handleLinkGitHub = async (event: FormEvent) => {
    event.preventDefault();
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
      setSuccess("GitHub account linked successfully.");
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to link GitHub account",
      );
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkGitHub = async () => {
    if (!integration) return;

    if (
      !confirm(
        "Are you sure you want to unlink your GitHub account? Recommendations will no longer map to this account.",
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");
    setUnlinking(true);

    try {
      await api.delete("/github/integration");
      setIntegration(null);
      setToken("");
      setSuccess("GitHub account unlinked successfully.");
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to unlink GitHub account",
      );
    } finally {
      setUnlinking(false);
    }
  };

  if (!hasHydrated || loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex h-[calc(100vh-64px)] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
            Developer Workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold">GitHub Integration</h1>
          <p className="mt-2 text-muted-foreground">
            Link your GitHub account to enable recommendation mapping.
          </p>
        </div>

        {error ? (
          <Alert className="mb-6 border-destructive/40 bg-destructive/10">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        ) : null}

        {success ? (
          <Alert className="mb-6 border-emerald-500/40 bg-emerald-500/10">
            <AlertDescription className="text-emerald-700">
              {success}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="border-border/60 bg-background/85">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Github className="h-5 w-5" />
              Account Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {integration ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  >
                    Linked
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    @{integration.github_username}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={handleUnlinkGitHub}
                    disabled={unlinking}
                  >
                    {unlinking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4" />
                    )}
                    {unlinking ? "Unlinking..." : "Unlink GitHub"}
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() =>
                      router.push("/dashboard/developer/recommendations")
                    }
                  >
                    <Sparkles className="h-4 w-4" />
                    View Recommendations
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleLinkGitHub}>
                <div className="space-y-2">
                  <label className="text-sm font-medium">GitHub username</label>
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="your-github-username"
                    required
                    disabled={linking}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">GitHub token</label>
                  <Input
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="github_pat_..."
                    required
                    disabled={linking}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" className="gap-2" disabled={linking}>
                    {linking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LinkIcon className="h-4 w-4" />
                    )}
                    {linking ? "Linking..." : "Link GitHub"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
