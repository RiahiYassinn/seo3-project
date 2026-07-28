"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleCheck,
  FolderGit2,
  Github,
  Sparkles,
  Target,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import {
  ProfileWorkspace,
  type ProfileStat,
} from "@/components/profile/profile-workspace";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatDate } from "@/lib/profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GitHubIntegration {
  id: string;
  github_username: string;
  connected_at: string;
}

interface RecommendationSummary {
  id: string;
  status: string;
  recommendation_type: string;
}

export default function DeveloperProfilePage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();

  const [integration, setIntegration] = useState<GitHubIntegration | null>(null);
  const [recommendations, setRecommendations] = useState<
    RecommendationSummary[]
  >([]);
  const [repositoryCount, setRepositoryCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    try {
      const integrationResponse =
        await api.get<GitHubIntegration>("/github/integration");
      setIntegration(integrationResponse.data);

      const [recommendationResponse, repositoryResponse] = await Promise.all([
        api.get<RecommendationSummary[]>("/recommendations/me"),
        api.get<unknown[]>("/github/repositories"),
      ]);

      setRecommendations(recommendationResponse.data || []);
      setRepositoryCount((repositoryResponse.data || []).length);
    } catch {
      // A developer without a linked GitHub account simply has no activity yet.
      setIntegration(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

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

    loadActivity();
  }, [hasHydrated, loadActivity, router, user]);

  const stats: ProfileStat[] = [
    {
      label: "Recommendations",
      value: recommendations.length,
      icon: Sparkles,
      hint: "Generated from your activity",
    },
    {
      label: "Open",
      value: recommendations.filter((item) => item.status === "open").length,
      icon: Target,
      hint: "Waiting on you",
    },
    {
      label: "Completed",
      value: recommendations.filter((item) => item.status === "completed")
        .length,
      icon: CircleCheck,
      hint: "Marked done",
    },
    {
      label: "Repositories",
      value: repositoryCount,
      icon: FolderGit2,
      hint: "Analyzed for your account",
    },
  ];

  if (!hasHydrated || !user) {
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
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.08),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_30%)]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
            Developer workspace
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">My profile</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Your identity across Dev.Lab, the GitHub account your analysis is
            built from, and everything you can change yourself.
          </p>
        </header>

        <ProfileWorkspace stats={stats} statsLoading={statsLoading}>
          <Card className="border-border/60 bg-background/85 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Github className="h-4 w-4" />
                    GitHub account
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The linked account decides which contributions are analyzed.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    integration
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : ""
                  }
                >
                  {integration ? "Linked" : "Not linked"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {integration ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold">
                      @{integration.github_username}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Linked {formatDate(integration.connected_at)}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="gap-2">
                    <Link href="/dashboard/developer/recommendations">
                      Manage connection
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-md text-sm text-muted-foreground">
                    Link your GitHub account to start generating skill profiles
                    and recommendations from your contributions.
                  </p>
                  <Button asChild className="gap-2">
                    <Link href="/dashboard/developer/recommendations">
                      Link GitHub
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </ProfileWorkspace>
      </main>
    </div>
  );
}
