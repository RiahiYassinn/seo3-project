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
import { Textarea } from "@/components/ui/textarea";
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
  MapPin,
  Send,
  UserRoundPlus,
  Video,
} from "lucide-react";
import { type RecommendationCase } from "@/app/dashboard/admin/profiles/profile-types";
import { cn } from "@/lib/utils";

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
  const [mode, setMode] = useState<"remote" | "onsite">("remote");
  const [location, setLocation] = useState("");

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
      setMode(data.mentorship_session_mode === "onsite" ? "onsite" : "remote");
      setLocation(data.mentorship_session_location || "");
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
    if (mode === "onsite" && !location.trim()) {
      setError("Add where the on-site session takes place.");
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
          mode,
          location: mode === "onsite" ? location.trim() : undefined,
        },
      );
      setRecommendation((previous) =>
        previous ? { ...previous, ...data } : data,
      );
      setScheduledAt(
        toDateTimeLocalValue(data.mentorship_session_scheduled_at),
      );
      setNote(data.mentorship_session_note || "");
      setMode(data.mentorship_session_mode === "onsite" ? "onsite" : "remote");
      setLocation(data.mentorship_session_location || "");
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {recommendation.mentorship_session_scheduled_at
                ? "Reschedule mentoring session"
                : "Schedule mentoring session"}
            </DialogTitle>
            <DialogDescription>
              {recommendation.contributor_login
                ? `@${recommendation.contributor_login} is emailed the details as soon as you confirm.`
                : "The developer is emailed the details as soon as you confirm."}
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              scheduleSession();
            }}
          >
            {/* --------------------------- Modality --------------------------- */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">How will you meet?</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      value: "remote" as const,
                      label: "Remote",
                      hint: "Teams link generated",
                      icon: Video,
                    },
                    {
                      value: "onsite" as const,
                      label: "On-site",
                      hint: "Meet in person",
                      icon: MapPin,
                    },
                  ]
                ).map((option) => {
                  const active = mode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={scheduling}
                      onClick={() => setMode(option.value)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                        active
                          ? "border-primary/45 bg-primary/[0.07] ring-1 ring-primary/15"
                          : "border-border/60 bg-muted/15 hover:border-primary/30 hover:bg-muted/30",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          active
                            ? "bg-primary/15 text-primary"
                            : "bg-background text-muted-foreground ring-1 ring-border/60",
                        )}
                      >
                        <option.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

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

            {/* Location only matters for on-site sessions. */}
            {mode === "onsite" ? (
              <div className="space-y-2">
                <Label htmlFor="session-location">Where</Label>
                <Input
                  id="session-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="e.g. Floor 3, Meeting room B"
                  disabled={scheduling}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Included in the invitation email.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3.5">
                <Video className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-5 text-muted-foreground">
                  A Microsoft Teams meeting is created automatically and the
                  join link goes out with the invitation. If Teams is not
                  configured on this environment, the session is still booked
                  and the email says you will share a link.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="session-note">Agenda</Label>
              <Textarea
                id="session-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What you plan to cover — shown to the developer in the invite."
                disabled={scheduling}
                rows={3}
              />
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
                  <Send className="h-4 w-4" />
                )}
                {scheduling
                  ? "Sending invite…"
                  : recommendation.mentorship_session_scheduled_at
                    ? "Update and resend"
                    : "Confirm and send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
