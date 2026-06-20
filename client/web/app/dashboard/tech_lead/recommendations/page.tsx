"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { authAPI } from "@/lib/auth";
import { RecommendationDetailPanel } from "@/components/recommendations/recommendation-detail-panel";
import { useAuthStore } from "@/lib/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  BriefcaseBusiness,
  CalendarClock,
  CircleAlert,
  Loader,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRoundPlus,
} from "lucide-react";
import { type RecommendationCase } from "@/app/dashboard/admin/profiles/profile-types";

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

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};
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
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleForms, setScheduleForms] = useState<
    Record<string, { scheduledAt: string; note: string }>
  >({});
  const [mentorAvailable, setMentorAvailable] = useState(
    Boolean(user?.is_mentor),
  );
  const [updatingAvailability, setUpdatingAvailability] = useState(false);

  useEffect(() => {
    setMentorAvailable(Boolean(user?.is_mentor));
  }, [user?.is_mentor]);

  const loadQueue = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }

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
        {
          mentorId,
        },
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

  const updateScheduleForm = (
    recommendationId: string,
    field: "scheduledAt" | "note",
    value: string,
  ) => {
    setScheduleForms((current) => ({
      ...current,
      [recommendationId]: {
        scheduledAt: current[recommendationId]?.scheduledAt || "",
        note: current[recommendationId]?.note || "",
        [field]: value,
      },
    }));
  };

  const scheduleSession = async (recommendation: MentorQueueRecommendation) => {
    const form = scheduleForms[recommendation.id];
    const scheduledAt = form?.scheduledAt;

    if (!scheduledAt) {
      setError("Choose a date and time for the mentoring session.");
      return;
    }

    setSchedulingId(recommendation.id);
    setError("");

    try {
      const { data } = await api.post<MentorQueueRecommendation>(
        `/recommendations/${recommendation.id}/schedule-session`,
        {
          scheduledAt: new Date(scheduledAt).toISOString(),
          note: form?.note?.trim() || undefined,
        },
      );

      if (data) {
        setQueue((previous) =>
          previous.map((item) =>
            item.id === recommendation.id ? { ...item, ...data } : item,
          ),
        );
        setScheduleForms((current) => ({
          ...current,
          [recommendation.id]: {
            scheduledAt: toDateTimeLocalValue(
              data.mentorship_session_scheduled_at,
            ),
            note: data.mentorship_session_note || "",
          },
        }));
      }
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to schedule mentoring session",
      );
    } finally {
      setSchedulingId(null);
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
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.08),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_30%)]">
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
                <Label
                  htmlFor="mentor-availability"
                  className="text-sm font-medium"
                >
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
            <CircleAlert className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Mentor availability is paused. You can still inspect the queue,
              but you cannot claim new mentorship assignments.
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
              <p className="mt-2 text-3xl font-semibold">
                {stats.highPriority}
              </p>
            </CardContent>
          </Card>
        </section>

        {mentorRequests.length > 0 ? (
          <section className="mb-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
                  Mentor requests
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Pending requests from developers
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Review these before you claim items from the wider mentorship
                  queue.
                </p>
              </div>
              <Badge variant="outline" className="w-fit">
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

                return (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-border/60 bg-background/80 p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Mentorship request
                        </p>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight">
                          {recommendation?.title || "Mentorship request"}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          From {requesterName} (@{requesterHandle})
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {recommendation?.repository_id
                            ? recommendation.context_snapshot?.repoName ||
                              recommendation.repository_id
                            : "Repository unavailable"}
                        </p>
                        {recommendation?.description ? (
                          <p className="mt-3 max-w-3xl text-sm text-foreground/90">
                            {recommendation.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-amber-700"
                        >
                          Pending
                        </Badge>
                        {recommendation?.priority_score ? (
                          <Badge variant="outline">
                            Priority {recommendation.priority_score}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
                        disabled={respondingRequestId === request.id}
                      >
                        {respondingRequestId === request.id ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <ThumbsUp className="h-4 w-4" />
                        )}
                        Accept request
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() =>
                          respondToRequest(
                            request.id,
                            request.mentor_id,
                            "decline",
                          )
                        }
                        disabled={respondingRequestId === request.id}
                      >
                        <ThumbsDown className="h-4 w-4" />
                        Decline request
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
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
                    <>
                      <Button
                        onClick={() => claimRecommendation(item.id)}
                        disabled={
                          !unclaimed ||
                          assigningId === item.id ||
                          !mentorAvailable
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
                      {claimedByMe ? (
                        <form
                          className="flex w-full flex-col gap-3 rounded-xl border border-border/60 bg-background/80 p-3 sm:flex-row sm:items-end"
                          onSubmit={(event) => {
                            event.preventDefault();
                            scheduleSession(item);
                          }}
                        >
                          <div className="min-w-[220px] flex-1 space-y-1">
                            <Label htmlFor={`session-date-${item.id}`}>
                              Session date and time
                            </Label>
                            <Input
                              id={`session-date-${item.id}`}
                              type="datetime-local"
                              value={
                                scheduleForms[item.id]?.scheduledAt ??
                                toDateTimeLocalValue(
                                  item.mentorship_session_scheduled_at,
                                )
                              }
                              onChange={(event) =>
                                updateScheduleForm(
                                  item.id,
                                  "scheduledAt",
                                  event.target.value,
                                )
                              }
                              disabled={schedulingId === item.id}
                            />
                          </div>
                          <div className="min-w-[220px] flex-1 space-y-1">
                            <Label htmlFor={`session-note-${item.id}`}>
                              Note
                            </Label>
                            <Input
                              id={`session-note-${item.id}`}
                              value={
                                scheduleForms[item.id]?.note ??
                                item.mentorship_session_note ??
                                ""
                              }
                              onChange={(event) =>
                                updateScheduleForm(
                                  item.id,
                                  "note",
                                  event.target.value,
                                )
                              }
                              placeholder="Optional agenda or meeting link"
                              disabled={schedulingId === item.id}
                            />
                          </div>
                          <Button
                            type="submit"
                            className="gap-2 sm:w-auto"
                            disabled={schedulingId === item.id}
                          >
                            {schedulingId === item.id ? (
                              <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                              <CalendarClock className="h-4 w-4" />
                            )}
                            Schedule
                          </Button>
                        </form>
                      ) : null}
                    </>
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
