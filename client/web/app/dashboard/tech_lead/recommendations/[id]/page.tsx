"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { RecommendationDetailPanel } from "@/components/recommendations/recommendation-detail-panel";
import { useAuthStore } from "@/lib/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  Loader,
  UserRoundPlus,
} from "lucide-react";
import { type RecommendationCase } from "@/app/dashboard/admin/profiles/profile-types";

type MentorQueueRecommendation = RecommendationCase & {
  recommendation_type: "mentorship";
};

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

export default function TechLeadRecommendationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();

  const [recommendation, setRecommendation] =
    useState<MentorQueueRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [note, setNote] = useState("");
  const [schedulerOpen, setSchedulerOpen] = useState(false);

  const loadRecommendation = useCallback(async () => {
    try {
      const { data } = await api.get<MentorQueueRecommendation>(
        `/recommendations/${id}`,
      );
      setRecommendation(data);
      setScheduledAt(
        toDateTimeLocalValue(data.mentorship_session_scheduled_at),
      );
      setNote(data.mentorship_session_note || "");
      setError("");
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to load recommendation",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

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
    loadRecommendation();
  }, [hasHydrated, loadRecommendation, router, user]);

  const claim = async () => {
    if (!recommendation) return;
    setAssigning(true);
    setError("");
    try {
      const { data } = await api.post<MentorQueueRecommendation>(
        `/recommendations/${recommendation.id}/assign-self`,
      );
      setRecommendation((previous) =>
        previous ? { ...previous, ...data } : data,
      );
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to claim recommendation",
      );
    } finally {
      setAssigning(false);
    }
  };

  const scheduleSession = async () => {
    if (!recommendation) return;
    if (!scheduledAt) {
      setError("Choose a date and time for the mentoring session.");
      return;
    }
    setScheduling(true);
    setError("");
    try {
      const { data } = await api.post<MentorQueueRecommendation>(
        `/recommendations/${recommendation.id}/schedule-session`,
        {
          scheduledAt: new Date(scheduledAt).toISOString(),
          note: note.trim() || undefined,
        },
      );
      setRecommendation((previous) =>
        previous ? { ...previous, ...data } : data,
      );
      setScheduledAt(
        toDateTimeLocalValue(data.mentorship_session_scheduled_at),
      );
      setNote(data.mentorship_session_note || "");
      setSchedulerOpen(false);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to schedule mentoring session",
      );
    } finally {
      setScheduling(false);
    }
  };

  if (!hasHydrated || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
          <div className="h-8 w-44 animate-pulse rounded bg-muted" />
          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="h-56 animate-pulse rounded-2xl bg-muted" />
              <div className="h-72 animate-pulse rounded-2xl bg-muted" />
            </div>
            <div className="h-64 animate-pulse rounded-2xl bg-muted" />
          </div>
        </main>
      </div>
    );
  }

  if (!recommendation) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <Alert variant="destructive" className="mb-4">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription>
              {error || "Recommendation not found."}
            </AlertDescription>
          </Alert>
          <Link
            href="/dashboard/tech_lead/recommendations"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to mentor queue
          </Link>
        </main>
      </div>
    );
  }

  const claimedByMe = recommendation.mentor_id === user?.id;
  const unclaimed = !recommendation.mentor_id;

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.08),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_30%)]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
        {/* The panel header carries the title, so this stays a breadcrumb. */}
        <div className="mb-4">
          <Link
            href="/dashboard/tech_lead/recommendations"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to mentor queue
          </Link>
        </div>

        {/* Global Error Banner */}
        {error && (
          <Alert variant="destructive" className="mb-6 shadow-sm">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* One cohesive report; the mentoring action closes it. */}
        <RecommendationDetailPanel
          recommendation={recommendation}
          primaryActionNote={
            unclaimed
              ? "Claim this case to schedule a session and become the developer's mentor."
              : claimedByMe
                ? recommendation.mentorship_session_scheduled_at
                  ? `Session set for ${new Date(
                      recommendation.mentorship_session_scheduled_at,
                    ).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}.`
                  : "You're mentoring this case — book a time with the developer."
                : "Another tech lead claimed this case, so scheduling is theirs to run."
          }
          primaryAction={
            unclaimed ? (
              <Button
                onClick={claim}
                disabled={assigning}
                size="lg"
                className="gap-2"
              >
                {assigning ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <UserRoundPlus className="h-4 w-4" />
                )}
                {assigning ? "Claiming…" : "Claim mentorship"}
              </Button>
            ) : claimedByMe ? (
              <Button
                size="lg"
                className="gap-2"
                onClick={() => setSchedulerOpen(true)}
              >
                <CalendarClock className="h-4 w-4" />
                {recommendation.mentorship_session_scheduled_at
                  ? "Reschedule mentoring session"
                  : "Schedule mentoring session"}
              </Button>
            ) : (
              <Button variant="outline" size="lg" asChild>
                <Link href="/dashboard/tech_lead/recommendations">
                  Back to queue
                </Link>
              </Button>
            )
          }
        />
      </main>

      {/* ---------------------------- Session scheduler ---------------------------- */}
      <Dialog open={schedulerOpen} onOpenChange={setSchedulerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {recommendation.mentorship_session_scheduled_at
                ? "Reschedule mentoring session"
                : "Schedule mentoring session"}
            </DialogTitle>
            <DialogDescription>
              The developer is notified as soon as you confirm.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              scheduleSession();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="session-date">Date and time</Label>
              <Input
                id="session-date"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                disabled={scheduling}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-note">Agenda or meeting link</Label>
              <Input
                id="session-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Meet link, or the two topics to cover"
                disabled={scheduling}
              />
              <p className="text-xs text-muted-foreground">
                Shown to the developer with the session time.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSchedulerOpen(false)}
                disabled={scheduling}
              >
                Cancel
              </Button>
              <Button type="submit" className="gap-2" disabled={scheduling}>
                {scheduling ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarClock className="h-4 w-4" />
                )}
                {recommendation.mentorship_session_scheduled_at
                  ? "Update session"
                  : "Confirm session"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
