"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { authAPI } from "@/lib/auth";
import { RecommendationDetailPanel } from "@/components/recommendations/recommendation-detail-panel";
import { useAuthStore } from "@/lib/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BriefcaseBusiness, CircleAlert, Loader, Sparkles, UserRoundPlus } from "lucide-react";
import { type RecommendationCase } from "@/app/dashboard/admin/profiles/profile-types";

type MentorQueueRecommendation = RecommendationCase & {
  recommendation_type: "mentorship";
};

export default function TechLeadRecommendationsPage() {
  const router = useRouter();
  const { user, hasHydrated, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<MentorQueueRecommendation[]>([]);
  const [mentorAvailable, setMentorAvailable] = useState(Boolean(user?.is_mentor));
  const [updatingAvailability, setUpdatingAvailability] = useState(false);

  useEffect(() => {
    setMentorAvailable(Boolean(user?.is_mentor));
  }, [user?.is_mentor]);

  const loadQueue = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const response = await api.get<MentorQueueRecommendation[]>(
        "/recommendations/mentor-queue",
      );
      setQueue(
        (response.data || []).slice().sort((left, right) => right.priority_score - left.priority_score),
      );
      setError("");
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to load mentorship queue",
      );
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "tech_lead") {
      router.replace("/dashboard");
      return;
    }

    loadQueue();
  }, [hasHydrated, loadQueue, router, user]);

  const stats = useMemo(() => {
    return {
      total: queue.length,
      open: queue.filter((item) => item.status === "open" && !item.mentor_id)
        .length,
      mine: queue.filter((item) => item.mentor_id === user?.id).length,
      highPriority: queue.filter((item) => item.priority_score >= 70).length,
    };
  }, [queue, user?.id]);

  const claimRecommendation = async (recommendationId: string) => {
    if (!mentorAvailable) {
      setError(
        "Enable mentor availability before claiming new mentorship assignments.",
      );
      return;
    }

    setAssigningId(recommendationId);
    try {
      const response = await api.post<MentorQueueRecommendation>(
        `/recommendations/${recommendationId}/assign-self`,
      );

      if (response.data) {
        setQueue((previous) =>
          previous.map((recommendation) =>
            recommendation.id === recommendationId
              ? { ...recommendation, ...response.data }
              : recommendation,
          ),
        );
      }
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to claim recommendation",
      );
    } finally {
      setAssigningId(null);
    }
  };

  const handleMentorAvailabilityChange = async (checked: boolean) => {
    const previousValue = mentorAvailable;
    setMentorAvailable(checked);
    setUpdatingAvailability(true);

    try {
      const response = await authAPI.updateMentorAvailability(checked);
      updateUser(response.user);
      setMentorAvailable(Boolean(response.user.is_mentor));
      setError("");
    } catch (requestError: any) {
      setMentorAvailable(previousValue);
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to update mentor availability",
      );
    } finally {
      setUpdatingAvailability(false);
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.08),transparent_22%),linear-gradient(180deg,#f8fafc,#eef2f7)]">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
              Mentorship Operations
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Tech Lead Mentor Queue
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Review escalated coaching recommendations with the same evidence
              package admins see, then claim the ones where mentorship will have
              the highest leverage.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/80 px-4 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="mentor-availability" className="text-sm font-medium">
                  Available for new mentoring
                </Label>
                <p className="text-xs text-muted-foreground">
                  Turn off to pause new mentorship assignments.
                </p>
              </div>
              <Switch
                id="mentor-availability"
                checked={mentorAvailable}
                onCheckedChange={handleMentorAvailabilityChange}
                disabled={updatingAvailability}
                aria-label="Toggle mentor availability"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => loadQueue(true)}
              disabled={refreshing}
              className="gap-2"
            >
              {refreshing ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Refreshing
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Refresh Queue
                </>
              )}
            </Button>
          </div>
        </div>

        {!mentorAvailable ? (
          <Alert className="mb-6 border-amber-500/40 bg-amber-500/10">
            <CircleAlert className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-amber-800">
              Mentor availability is paused. You can still inspect the queue, but
              you cannot claim new mentorship assignments.
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert className="mb-6 border-destructive/40 bg-destructive/10">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/60 bg-background/80 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Queue size</p>
              <p className="mt-2 text-3xl font-semibold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-background/80 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Unclaimed</p>
              <p className="mt-2 text-3xl font-semibold">{stats.open}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-background/80 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Assigned to me</p>
              <p className="mt-2 text-3xl font-semibold">{stats.mine}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-background/80 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">High priority</p>
              <p className="mt-2 text-3xl font-semibold">{stats.highPriority}</p>
            </CardContent>
          </Card>
        </section>

        {queue.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-background/70">
            <CardContent className="p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BriefcaseBusiness className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                No mentorship recommendations yet
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                New items will appear automatically when analysis completes and
                mentorship is recommended.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {queue.map((item) => {
              const claimedByMe = item.mentor_id === user?.id;
              const unclaimed = !item.mentor_id;

              return (
                <RecommendationDetailPanel
                  key={item.id}
                  recommendation={item}
                  compact
                  actions={
                    <Button
                      onClick={() => claimRecommendation(item.id)}
                      disabled={
                        !unclaimed || assigningId === item.id || !mentorAvailable
                      }
                      className="gap-2"
                      variant={claimedByMe ? "outline" : "default"}
                    >
                      {assigningId === item.id ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          Claiming
                        </>
                      ) : claimedByMe ? (
                        "Assigned to You"
                      ) : (
                        <>
                          <UserRoundPlus className="h-4 w-4" />
                          Claim Mentorship
                        </>
                      )}
                    </Button>
                  }
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
