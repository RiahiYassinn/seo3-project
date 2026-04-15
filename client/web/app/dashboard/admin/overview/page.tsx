"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowRight,
  CircleAlert,
  Github,
  LayoutDashboard,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface RepositoryRecord {
  id: string;
  repo_name: string;
  analysis_metadata: {
    contributorProfiles?: Record<string, ContributorProfile>;
  } | null;
}

interface ContributorProfile {
  contributorLogin: string;
  repositoryName: string;
  analyzedAt: string | null;
  qualityScore: number | null;
  skillLevel: string | null;
  topWeaknesses: Array<{ category?: string; score?: number }>;
  recommendations: Array<{ action?: string }>;
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRepositories = async () => {
      try {
        const { data } = await api.get<RepositoryRecord[]>("/github/repositories");
        setRepositories(data || []);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ??
            err.message ??
            "Failed to load admin overview",
        );
      } finally {
        setLoading(false);
      }
    };

    loadRepositories();
  }, []);

  const contributorProfiles = useMemo(() => {
    return repositories
      .flatMap((repository) =>
        Object.values(repository.analysis_metadata?.contributorProfiles || {}),
      )
      .sort((left, right) => {
        const leftTime = left.analyzedAt ? new Date(left.analyzedAt).getTime() : 0;
        const rightTime = right.analyzedAt
          ? new Date(right.analyzedAt).getTime()
          : 0;
        return rightTime - leftTime;
      });
  }, [repositories]);

  const stats = [
    {
      label: "Repositories ready",
      value: repositories.length,
      hint: "Synced from the admin GitHub connection",
      icon: Github,
    },
    {
      label: "Profiles generated",
      value: contributorProfiles.length,
      hint: "Contributor skill profiles created from commit analysis",
      icon: Users,
    },
    {
      label: "Recent analyses",
      value: contributorProfiles.filter((profile) => !!profile.analyzedAt).length,
      hint: "Profiles with a completed analysis run",
      icon: Target,
    },
  ];

  return (
    <AdminShell
      title="Contributor Intelligence Overview"
      subtitle="One admin workspace now runs the GitHub connection, repository selection, contributor analysis, and generated developer skill profiles."
      actions={
        <Button onClick={() => router.push("/dashboard/admin/github")} className="gap-2">
          <Github className="h-4 w-4" />
          Open GitHub Flow
        </Button>
      }
    >
      {error && (
        <Alert className="mb-6 border-destructive/40 bg-destructive/10">
          <CircleAlert className="h-4 w-4" />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="overflow-hidden border-border/60 bg-background/80 shadow-sm"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-3 text-4xl font-bold">{loading ? "--" : stat.value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{stat.hint}</p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>How the new admin flow works</CardTitle>
                <p className="text-sm text-muted-foreground">
                  A single workflow from GitHub connection to developer coaching output.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-3xl border border-border/60 bg-muted/20 p-5">
              <p className="font-semibold text-foreground">1. Link GitHub once</p>
              <p className="mt-1">
                The admin connects the platform to GitHub and syncs accessible repositories.
              </p>
            </div>
            <div className="rounded-3xl border border-border/60 bg-muted/20 p-5">
              <p className="font-semibold text-foreground">2. Pick a repository and contributors</p>
              <p className="mt-1">
                Contributors are listed from the selected repository so the admin can choose who to analyze.
              </p>
            </div>
            <div className="rounded-3xl border border-border/60 bg-muted/20 p-5">
              <p className="font-semibold text-foreground">3. Generate a developer profile automatically</p>
              <p className="mt-1">
                Each contributor analysis creates a skill profile with weaknesses, strengths, and recommendations.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardHeader>
            <CardTitle>Recent contributor profiles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contributorProfiles.slice(0, 5).map((profile) => (
              <div
                key={`${profile.repositoryName}-${profile.contributorLogin}`}
                className="rounded-3xl border border-border/60 bg-muted/20 p-5 transition hover:border-primary/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">@{profile.contributorLogin}</p>
                    <p className="text-sm text-muted-foreground">
                      {profile.repositoryName}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {profile.qualityScore !== null ? `${profile.qualityScore}/10` : "Pending"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {profile.topWeaknesses?.[0]?.category
                    ? `Top weakness: ${profile.topWeaknesses[0].category}`
                    : "Recommendations will appear after analysis completes."}
                </p>
              </div>
            ))}
            {!loading && contributorProfiles.length === 0 && (
              <div className="rounded-3xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                Contributor profiles will show up here after the first repository analysis batch.
              </div>
            )}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => router.push("/dashboard/admin/profiles")}
            >
              <Sparkles className="h-4 w-4" />
              Open developer profiles
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardHeader>
            <CardTitle>Why this is different</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-border/60 bg-muted/20 p-6">
              <div className="mb-3 inline-flex rounded-full bg-primary/10 p-2 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <p className="font-semibold">Admins drive the workflow</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Developers no longer need to log in and manage their own repository analysis flow.
              </p>
            </div>
            <div className="rounded-3xl border border-border/60 bg-muted/20 p-6">
              <div className="mb-3 inline-flex rounded-full bg-primary/10 p-2 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="font-semibold">Profiles are generated from real commit activity</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Each selected contributor gets a profile centered on weaknesses, strengths, and recommended next steps.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}
