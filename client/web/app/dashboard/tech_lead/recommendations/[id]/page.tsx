"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  format,
  addDays,
  setHours,
  setMinutes,
  isBefore,
  startOfDay,
} from "date-fns";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { RecommendationDetailPanel } from "@/components/recommendations/recommendation-detail-panel";
import { useAuthStore } from "@/lib/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Calendar as CalendarIcon,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Clock,
  Globe,
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

// Generate 30-minute interval time slots for the dropdown (08:00 AM to 08:00 PM)
const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30; // Starts at 08:00
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hStr = hours.toString().padStart(2, "0");
  const mStr = minutes.toString().padStart(2, "0");
  return `${hStr}:${mStr}`;
});

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
  const [ackLoading, setAckLoading] = useState(false);

  // Scheduling State
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("10:00");
  const [note, setNote] = useState("");
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [mode, setMode] = useState<"remote" | "onsite">("remote");
  const [location, setLocation] = useState("");
  const [userTimezone, setUserTimezone] = useState("");

  useEffect(() => {
    // Detect local timezone abbreviation or offset
    try {
      setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setUserTimezone("Local Time");
    }
  }, []);

  const loadRecommendation = useCallback(async () => {
    try {
      const { data } = await api.get<MentorQueueRecommendation>(
        `/recommendations/${id}`,
      );
      setRecommendation(data);

      if (data.mentorship_session_scheduled_at) {
        const d = new Date(data.mentorship_session_scheduled_at);
        setSelectedDate(d);
        const hours = d.getHours().toString().padStart(2, "0");
        const minutes = d.getMinutes().toString().padStart(2, "0");
        setSelectedTime(`${hours}:${minutes}`);
      } else {
        setSelectedDate(addDays(new Date(), 1)); // Default to tomorrow
      }

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
    if (!selectedDate) {
      setError("Please choose a date for the mentoring session.");
      return;
    }
    if (mode === "onsite" && !location.trim()) {
      setError("Add where the on-site session takes place.");
      return;
    }

    // Combine Date and Time
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const finalDateTime = setMinutes(setHours(selectedDate, hours), minutes);

    setScheduling(true);
    setError("");
    try {
      const { data } = await api.post<MentorQueueRecommendation>(
        `/recommendations/${recommendation.id}/schedule-session`,
        {
          scheduledAt: finalDateTime.toISOString(),
          note: note.trim() || undefined,
          mode,
          location: mode === "onsite" ? location.trim() : undefined,
        },
      );
      setRecommendation((previous) =>
        previous ? { ...previous, ...data } : data,
      );
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

  const markCompleted = async () => {
    if (!recommendation) return;
    setAckLoading(true);
    setError("");
    try {
      const { data } = await api.post<MentorQueueRecommendation>(
        `/recommendations/${recommendation.id}/acknowledge`,
      );
      if (data) {
        setRecommendation((previous) =>
          previous ? { ...previous, ...data } : data,
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
        <div className="mb-4">
          <Link
            href="/dashboard/tech_lead/recommendations"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to mentor queue
          </Link>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 shadow-sm">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <RecommendationDetailPanel
          recommendation={recommendation}
          actions={
            claimedByMe ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={recommendation.status === "completed" || ackLoading}
                onClick={markCompleted}
              >
                {ackLoading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <CircleCheck className="h-4 w-4" />
                )}
                {recommendation.status === "completed"
                  ? "Completed"
                  : "Mark completed"}
              </Button>
            ) : undefined
          }
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

      {/* ---------------------------- Enhanced Session Scheduler Modal ---------------------------- */}
      <Dialog open={schedulerOpen} onOpenChange={setSchedulerOpen}>
        <DialogContent className="max-w-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {recommendation.mentorship_session_scheduled_at
                ? "Reschedule mentoring session"
                : "Schedule mentoring session"}
            </DialogTitle>
            <DialogDescription>
              {recommendation.contributor_login
                ? `@${recommendation.contributor_login} will receive a calendar invite once confirmed.`
                : "The developer will receive a calendar invite once confirmed."}
            </DialogDescription>
          </DialogHeader>

          <form
            className="mt-2 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              scheduleSession();
            }}
          >
            {/* Modality Picker */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Meeting Format
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    value: "remote" as const,
                    label: "Remote",
                    hint: "Auto-generated Teams link",
                    icon: Video,
                  },
                  {
                    value: "onsite" as const,
                    label: "On-site",
                    hint: "In-person location",
                    icon: MapPin,
                  },
                ].map((option) => {
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
                        "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border/60 bg-card hover:border-border hover:bg-accent/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          active
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <option.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {option.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Redesigned Date and Time Picker Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date & Time
                </Label>
                {userTimezone && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    {userTimezone}
                  </span>
                )}
              </div>

              {/* Quick Date Presets */}
              <div className="flex gap-2">
                {[
                  { label: "Today", days: 0 },
                  { label: "Tomorrow", days: 1 },
                  { label: "Next Week", days: 7 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setSelectedDate(addDays(new Date(), preset.days))
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Calendar Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground",
                      )}
                      disabled={scheduling}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {selectedDate ? (
                        format(selectedDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) =>
                        isBefore(date, startOfDay(new Date()))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* Time Selector Dropdown */}
                <Select
                  value={selectedTime}
                  onValueChange={setSelectedTime}
                  disabled={scheduling}
                >
                  <SelectTrigger className="w-full">
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location or Meeting Link Notice */}
            {mode === "onsite" ? (
              <div className="space-y-1.5">
                <Label
                  htmlFor="session-location"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Location / Room
                </Label>
                <Input
                  id="session-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Floor 3, Meeting room B"
                  disabled={scheduling}
                  required
                />
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-3">
                <Video className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A Teams calendar invite with video details will be generated
                  automatically upon scheduling.
                </p>
              </div>
            )}

            {/* Agenda Notes */}
            <div className="space-y-1.5">
              <Label
                htmlFor="session-note"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Agenda & Notes
              </Label>
              <Textarea
                id="session-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Outline what you plan to review during this session..."
                disabled={scheduling}
                rows={3}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
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
