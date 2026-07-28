"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { authAPI } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  BriefcaseBusiness,
  ChevronRight,
  CircleAlert,
  Clock3,
  Flame,
  FolderGit2,
  Inbox,
  Loader,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  UserRoundPlus,
  X,
} from "lucide-react";
import {
  priorityBand,
  type RecommendationCase,
} from "@/app/dashboard/admin/profiles/profile-types";
import { cn } from "@/lib/utils";

type MentorQueueRecommendation = RecommendationCase & {
  recommendation_type: "mentorship";
};

interface MentorRequestRecord {
  id: string;
  recommendation_id: string;
  mentor_id: string;
  status: "pending" | "accepted" | "declined";
  requester_snapshot?: {
    id?: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
  } | null;
  mentor_snapshot?: {
    id?: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
  } | null;
  recommendation?: MentorQueueRecommendation | null;
  created_at: string;
  updated_at: string;
  responded_at?: string | null;
}

type QueueFilter = "all" | "unclaimed" | "mine" | "high";

export default function TechLeadRecommendationsPage() {
  const router = useRouter();
  const { user, hasHydrated, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<MentorQueueRecommendation[]>([]);
  const [mentorRequests, setMentorRequests] = useState<MentorRequestRecord[]>(
    [],
  );
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(
    null,
  );
  const [mentorAvailable, setMentorAvailable] = useState(
    Boolean(user?.is_mentor),
  );
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMentorAvailable(Boolean(user?.is_mentor));
  }, [user?.is_mentor]);

  const loadQueue = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [queueResponse, requestResponse] = await Promise.all([
        api.get<MentorQueueRecommendation[]>("/recommendations/mentor-queue"),
        api.get<MentorRequestRecord[]>("/recommendations/mentor-requests"),
      ]);
      setQueue(
        (queueResponse.data || [])
          .slice()
          .sort((left, right) => right.priority_score - left.priority_score),
      );
      setMentorRequests((requestResponse.data || []).slice());
      setError("");
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to load mentorship queue",
      );
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
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

  const visibleQueue = useMemo(() => {
    const term = search.trim().toLowerCase();

    return queue.filter((item) => {
      if (queueFilter === "unclaimed" && item.mentor_id) return false;
      if (queueFilter === "mine" && item.mentor_id !== user?.id) return false;
      if (queueFilter === "high" && item.priority_score < 70) return false;

      if (!term) return true;

      return [
        item.title,
        item.description,
        item.contributor_login,
        item.context_snapshot?.repoName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [queue, queueFilter, search, user?.id]);

  const filtersActive = queueFilter !== "all" || search.trim() !== "";

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

  const respondToRequest = async (
    requestId: string,
    mentorId: string,
    action: "accept" | "decline",
  ) => {
    setRespondingRequestId(requestId);
    setError("");
    try {
      await api.post(
        `/recommendations/mentor-requests/${requestId}/${action}`,
        { mentorId },
      );
      await loadQueue(true);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          `Failed to ${action} mentor request`,
      );
    } finally {
      setRespondingRequestId(null);
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

  const filterOptions: Array<{
    value: QueueFilter;
    label: string;
    count: number;
  }> = [
    { value: "all", label: "All", count: stats.total },
    { value: "unclaimed", label: "Unclaimed", count: stats.open },
    { value: "mine", label: "Mine", count: stats.mine },
    { value: "high", label: "High priority", count: stats.highPriority },
  ];

  if (!hasHydrated || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="h-4 w-44 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-10 w-72 animate-pulse rounded bg-muted" />
          <div className="mt-8 h-16 animate-pulse rounded-2xl bg-muted" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <div
                key={card}
                className="h-52 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.08),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_30%)]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
              Mentorship operations
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Mentor queue
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Answer the developers waiting on you, then claim the cases where
              your time has the most leverage.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => loadQueue(true)}
            disabled={refreshing}
            className="gap-2 lg:shrink-0"
          >
            {refreshing ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        </header>

        {error ? (
          <Alert className="mb-6 border-destructive/40 bg-destructive/10">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3 text-destructive">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss"
                className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </AlertDescription>
          </Alert>
        ) : null}

        {/* ------------------------ Availability control ------------------------ */}
        <Card
          className={cn(
            "mb-6 border-border/60 shadow-sm transition-colors",
            mentorAvailable
              ? "bg-background/80"
              : "border-amber-500/40 bg-amber-500/[0.07]",
          )}
        >
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  mentorAvailable
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                )}
              >
                <UserRoundPlus className="h-4 w-4" />
              </span>
              <div>
                <Label
                  htmlFor="mentor-availability"
                  className="text-sm font-semibold"
                >
                  {mentorAvailable
                    ? "Available for new mentoring"
                    : "Mentoring paused"}
                </Label>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {mentorAvailable
                    ? "Developers can request you, and you can claim cases from the queue."
                    : "You can still inspect the queue, but you cannot claim new cases."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              {updatingAvailability ? (
                <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : null}
              <Switch
                id="mentor-availability"
                checked={mentorAvailable}
                onCheckedChange={handleMentorAvailabilityChange}
                disabled={updatingAvailability}
                aria-label="Toggle mentor availability"
              />
            </div>
          </CardContent>
        </Card>

        {/* -------------------------- Pending requests -------------------------- */}
        {mentorRequests.length > 0 ? (
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
              <h2 className="text-lg font-semibold tracking-tight">
                Waiting on your response
              </h2>
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                {mentorRequests.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {mentorRequests.map((request) => {
                const recommendation = request.recommendation;
                const requesterName =
                  request.requester_snapshot?.name ||
                  request.requester_snapshot?.username ||
                  request.requester_snapshot?.email ||
                  "Developer";
                const requesterHandle =
                  request.requester_snapshot?.username ||
                  request.requester_snapshot?.email ||
                  request.requester_snapshot?.id ||
                  "unknown";
                const isResponding = respondingRequestId === request.id;
                const band = priorityBand(recommendation?.priority_score);

                return (
                  <Card
                    key={request.id}
                    className="overflow-hidden border-amber-500/25 bg-background/85 shadow-sm"
                  >
                    <div className="flex">
                      <span
                        aria-hidden="true"
                        className="w-1 shrink-0 bg-amber-500"
                      />
                      <CardContent className="flex-1 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <h3 className="text-base font-semibold tracking-tight">
                              {recommendation?.title || "Mentorship request"}
                            </h3>
                            <p className="mt-1.5 text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {requesterName}
                              </span>{" "}
                              (@{requesterHandle}) asked for your help
                            </p>
                            {recommendation?.description ? (
                              <p className="mt-2 max-w-3xl line-clamp-2 text-sm leading-6 text-muted-foreground">
                                {recommendation.description}
                              </p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <FolderGit2 className="h-3.5 w-3.5" />
                                {recommendation?.context_snapshot?.repoName ||
                                  recommendation?.repository_id ||
                                  "Repository unavailable"}
                              </span>
                              {recommendation?.priority_score ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 font-medium",
                                    band.text,
                                  )}
                                >
                                  <Flame className="h-3.5 w-3.5" />
                                  {band.label}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:shrink-0">
                            <Button
                              type="button"
                              className="gap-2"
                              onClick={() =>
                                respondToRequest(
                                  request.id,
                                  request.mentor_id,
                                  "accept",
                                )
                              }
                              disabled={isResponding}
                            >
                              {isResponding ? (
                                <Loader className="h-4 w-4 animate-spin" />
                              ) : (
                                <ThumbsUp className="h-4 w-4" />
                              )}
                              Accept
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="gap-2 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                respondToRequest(
                                  request.id,
                                  request.mentor_id,
                                  "decline",
                                )
                              }
                              disabled={isResponding}
                            >
                              <ThumbsDown className="h-4 w-4" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ------------------------------ Toolbar ------------------------------ */}
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-0.5">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setQueueFilter(option.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  queueFilter === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
                <span
                  className={cn(
                    "ml-1.5 text-xs",
                    queueFilter === option.value
                      ? "font-semibold text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {option.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search the queue"
                className="pl-9"
                aria-label="Search the mentor queue"
              />
            </div>
            {filtersActive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => {
                  setQueueFilter("all");
                  setSearch("");
                }}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {/* ------------------------------- Queue ------------------------------- */}
        {queue.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-background/70">
            <CardContent className="p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BriefcaseBusiness className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                No mentorship cases yet
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Cases appear here automatically when analysis completes and
                mentorship is the recommended next step.
              </p>
            </CardContent>
          </Card>
        ) : visibleQueue.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-background/70">
            <CardContent className="p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Inbox className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                Nothing matches these filters
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Clear them to see all {stats.total} cases in the queue.
              </p>
              <Button
                variant="outline"
                className="mt-5"
                onClick={() => {
                  setQueueFilter("all");
                  setSearch("");
                }}
              >
                Clear filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleQueue.map((item) => {
              const claimedByMe = item.mentor_id === user?.id;
              const unclaimed = !item.mentor_id;
              const repoName =
                item.context_snapshot?.repoName ||
                item.repository_id ||
                "Unknown repo";
              const band = priorityBand(item.priority_score);

              return (
                <Card
                  key={item.id}
                  className={cn(
                    "group relative flex flex-col overflow-hidden border-border/60 bg-background/85 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md motion-reduce:hover:translate-y-0",
                    claimedByMe && "border-emerald-500/30",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-0 left-0 w-1",
                      claimedByMe ? "bg-emerald-500" : band.rail,
                    )}
                  />
                  <CardContent className="flex flex-1 flex-col p-5 pl-6">
                    <div className="flex items-start justify-between gap-3">
                      {/* Stretched link keeps the whole card clickable without
                          nesting the claim button inside an anchor. */}
                      <h3 className="line-clamp-2 text-base font-semibold tracking-tight">
                        <Link
                          href={`/dashboard/tech_lead/recommendations/${item.id}`}
                          className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {item.title}
                        </Link>
                      </h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          claimedByMe
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : unclaimed
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : "",
                        )}
                      >
                        {claimedByMe
                          ? "Yours"
                          : unclaimed
                            ? "Unclaimed"
                            : "Claimed"}
                      </Badge>
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {item.description || "No description provided."}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <FolderGit2 className="h-3.5 w-3.5" />
                        <span className="truncate">{repoName}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />@
                        {item.contributor_login}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 font-medium",
                          band.text,
                        )}
                      >
                        <Flame className="h-3.5 w-3.5" />
                        {band.short}
                      </span>
                      {item.mentorship_session_scheduled_at ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {new Date(
                            item.mentorship_session_scheduled_at,
                          ).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3.5">
                      {unclaimed ? (
                        <Button
                          size="sm"
                          className="relative z-10 gap-2"
                          disabled={assigningId === item.id || !mentorAvailable}
                          title={
                            mentorAvailable
                              ? undefined
                              : "Turn on mentoring availability to claim cases"
                          }
                          onClick={() => claimRecommendation(item.id)}
                        >
                          {assigningId === item.id ? (
                            <Loader className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserRoundPlus className="h-4 w-4" />
                          )}
                          Claim
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {claimedByMe
                            ? "You're mentoring this"
                            : "Claimed by another mentor"}
                        </span>
                      )}
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
                        Open
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
