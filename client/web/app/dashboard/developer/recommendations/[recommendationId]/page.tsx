"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
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
    return recommendations.find((item) => item.id === recommendationId) || null;
  }, [recommendationId, recommendations]);

  /**
   * This page explains *why*; the plan page is where the work happens. Only
   * mentorship without a mentor sends them elsewhere — the mentor picker lives
   * on the feed.
   */
  const developerCta = useMemo(() => {
    const planHref = `/dashboard/developer/recommendations/${recommendationId}/plan`;

    if (!recommendation) {
      return { label: "Open action plan", href: planHref, note: "" };
    }

    if (recommendation.recommendation_type === "mentorship") {
      return recommendation.mentor_id
        ? {
            label: "Open mentoring plan",
            href: planHref,
            note: "See your mentor and session details.",
          }
        : {
            label: "Find a mentor",
            href: "/dashboard/developer/recommendations",
            note: "Pick an available mentor to get this moving.",
          };
    }

    if (recommendation.recommendation_type === "docs_review") {
      const items = recommendation.docs_review?.checklist?.length || 0;
      return {
        label: "Open docs checklist",
        href: planHref,
        note: items
          ? `${items} item${items === 1 ? "" : "s"} to work through — usually under an hour.`
          : "A short, targeted checklist.",
      };
    }

    const hours = recommendation.learning_path?.estimatedTotalHours;
    const steps = recommendation.learning_path?.steps?.length || 0;

    return {
      label: "Start learning path",
      href: planHref,
      note: steps
        ? `${steps} step${steps === 1 ? "" : "s"}${
            typeof hours === "number" ? `, about ${hours} hours` : ""
          } built from the gaps above.`
        : "Work through your plan step by step.",
    };
  }, [recommendation, recommendationId]);

  if (!hasHydrated || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="h-8 w-44 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-56 animate-pulse rounded-2xl bg-muted" />
          <div className="mt-6 h-40 animate-pulse rounded-2xl bg-muted" />
          <div className="mt-6 h-72 animate-pulse rounded-2xl bg-muted" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.08),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_30%)]">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* The panel header carries the title, so this stays a breadcrumb. */}
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm" className="-ml-3 gap-2">
            <Link href="/dashboard/developer/recommendations">
              <ArrowLeft className="h-4 w-4" />
              Back to recommendations
            </Link>
          </Button>
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
                It may have been removed or may not belong to your linked GitHub
                account.
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
            primaryActionNote={developerCta.note}
            primaryAction={
              <Button asChild size="lg" className="group gap-2">
                <Link href={developerCta.href}>
                  {developerCta.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              </Button>
            }
          />
        )}
      </main>
    </div>
  );
}
