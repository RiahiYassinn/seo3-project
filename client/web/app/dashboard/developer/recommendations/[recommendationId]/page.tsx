"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CircleCheck, Loader2, Sparkles } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { RecommendationDetailPanel } from "@/components/recommendations/recommendation-detail-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { type RecommendationCase } from "@/app/dashboard/admin/profiles/profile-types";

interface RepositoryRecord {
  id: string;
  repo_name: string;
}

export default function DeveloperRecommendationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const recommendationId = Array.isArray(params.recommendationId)
    ? params.recommendationId[0]
    : params.recommendationId;
  const { user, hasHydrated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendationCase[]>(
    [],
  );
  const [repositories, setRepositories] = useState<Record<string, string>>({});
  const [ackLoading, setAckLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [recommendationResponse, repositoryResponse] = await Promise.all([
        api.get<RecommendationCase[]>("/recommendations/me"),
        api.get<RepositoryRecord[]>("/github/repositories"),
      ]);

      const repoNameMap: Record<string, string> = {};
      for (const repository of repositoryResponse.data || []) {
        repoNameMap[repository.id] = repository.repo_name;
      }

      setRecommendations(recommendationResponse.data || []);
      setRepositories(repoNameMap);
      setError("");
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to load recommendation details",
      );
    } finally {
      setLoading(false);
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

    loadData();
  }, [hasHydrated, loadData, router, user]);

  const recommendation = useMemo(() => {
    return (
      recommendations.find((item) => item.id === recommendationId) || null
    );
  }, [recommendationId, recommendations]);

  const acknowledgeRecommendation = async () => {
    if (!recommendation) return;

    setAckLoading(true);
    setError("");

    try {
      const { data } = await api.post<RecommendationCase>(
        `/recommendations/${recommendation.id}/acknowledge`,
      );

      if (data) {
        setRecommendations((current) =>
          current.map((item) =>
            item.id === recommendation.id ? { ...item, ...data } : item,
          ),
        );
      }
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to update recommendation status",
      );
    } finally {
      setAckLoading(false);
    }
  };

  if (!hasHydrated || loading) {
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

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Button asChild variant="ghost" className="-ml-3 mb-3 gap-2">
              <Link href="/dashboard/developer/recommendations">
                <ArrowLeft className="h-4 w-4" />
                Back to recommendations
              </Link>
            </Button>
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
              Recommendation Details
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Issues and next steps
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Review the issues found in your analysis, then use the generated
              recommendation to decide what to work on next.
            </p>
          </div>

          {recommendation ? (
            <Button
              type="button"
              className="gap-2"
              variant={
                recommendation.status === "completed" ? "outline" : "default"
              }
              disabled={recommendation.status === "completed" || ackLoading}
              onClick={acknowledgeRecommendation}
            >
              {ackLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : recommendation.status === "completed" ? (
                <CircleCheck className="h-4 w-4" />
              ) : null}
              {recommendation.status === "completed"
                ? "Completed"
                : "Mark completed"}
            </Button>
          ) : null}
        </div>

        {error ? (
          <Alert className="mb-6 border-destructive/40 bg-destructive/10">
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        ) : null}

        {!recommendation ? (
          <Card className="border-dashed border-border/60 bg-background/80">
            <CardContent className="p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                Recommendation not found
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                It may have been removed or may not belong to your linked
                GitHub account.
              </p>
              <Button asChild className="mt-5">
                <Link href="/dashboard/developer/recommendations">
                  View recommendations
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <RecommendationDetailPanel
            recommendation={recommendation}
            repositoryName={repositories[recommendation.repository_id]}
          />
        )}
      </main>
    </div>
  );
}
