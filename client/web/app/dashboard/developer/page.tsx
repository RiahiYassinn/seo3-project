"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store";
import { Github, Link as LinkIcon, Sparkles } from "lucide-react";

interface GitHubIntegration {
  id: string;
  github_username: string;
  connected_at: string;
}

export default function DeveloperDashboardRedirect() {
  const { user, hasHydrated } = useAuthStore();
  const router = useRouter();
  const [checkingIntegration, setCheckingIntegration] = useState(true);
  const [integration, setIntegration] = useState<GitHubIntegration | null>(
    null,
  );

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

    const fetchIntegration = async () => {
      try {
        const { data } = await api.get<GitHubIntegration>(
          "/github/integration",
        );
        setIntegration(data);
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          console.error("Failed to load GitHub integration", error);
        }
        setIntegration(null);
      } finally {
        setCheckingIntegration(false);
      }
    };

    fetchIntegration();
  }, [user, hasHydrated, router]);

  if (!hasHydrated || !user || checkingIntegration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
          <h1 className="mt-2 text-3xl font-bold">Actions</h1>
          <p className="mt-2 text-muted-foreground">
            Link your GitHub account, then view recommendations generated from
            that linked account.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-background/85">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Github className="h-5 w-5" />
                GitHub account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {integration ? (
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
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Not linked</Badge>
                  <span className="text-sm text-muted-foreground">
                    Connect GitHub to enable recommendation mapping.
                  </span>
                </div>
              )}

              <Button
                className="w-full gap-2"
                onClick={() =>
                  router.push("/dashboard/developer/recommendations")
                }
              >
                <LinkIcon className="h-4 w-4" />
                {integration ? "Manage GitHub & Recommendations" : "Link GitHub"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/85">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                View recommendations generated for your linked GitHub account.
              </p>
              <Button
                className="w-full"
                variant={integration ? "default" : "outline"}
                disabled={!integration}
                onClick={() =>
                  router.push("/dashboard/developer/recommendations")
                }
              >
                View Recommendations
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
