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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  Loader,
  UserRoundPlus,
  CheckCircle2,
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
        <div className="flex h-[calc(100vh-64px)] items-center justify-center">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
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
    <div className="min-h-screen bg-muted/20">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
        {/* Top Breadcrumb Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/tech_lead/recommendations"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to mentor queue
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            Recommendation Details
          </h1>
        </div>

        {/* Global Error Banner */}
        {error && (
          <Alert variant="destructive" className="mb-6 shadow-sm">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Main Content Layout Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Data Display (Takes 2/3 width) */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-1">
              {/* Pass empty or minimal actions if required by component contract */}
              <RecommendationDetailPanel recommendation={recommendation} />
            </div>
          </div>

          {/* Right Column: Workflow Action Panels (Takes 1/3 width) */}
          <div className="space-y-6">
            {/* Case 1: Unclaimed Mentorship Card */}
            {unclaimed && (
              <Card className="border-primary/20 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Open Recommendation</CardTitle>
                  <CardDescription>
                    This case has not been assigned. Claim it to manage the
                    mentorship and scheduling.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={claim}
                    disabled={assigning}
                    className="w-full gap-2 shadow-sm"
                    size="lg"
                  >
                    {assigning ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Claiming Case...
                      </>
                    ) : (
                      <>
                        <UserRoundPlus className="h-4 w-4" />
                        Claim Mentorship
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Case 2: Claimed by Someone Else */}
            {!unclaimed && !claimedByMe && (
              <Card className="bg-muted/50">
                <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                  This mentorship case is currently assigned to another Tech
                  Lead.
                </CardContent>
              </Card>
            )}

            {/* Case 3: Claimed By Me -> Show Scheduler Form */}
            {claimedByMe && (
              <Card className="border-emerald-500/20 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Assigned to You
                    </span>
                  </div>
                  <CardTitle className="text-lg mt-1">
                    Session Actions
                  </CardTitle>
                  <CardDescription>
                    Set up or update the date and strategy notes for this
                    session.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      scheduleSession();
                    }}
                  >
                    <div className="space-y-2">
                      <Label
                        htmlFor="session-date"
                        className="text-sm font-medium"
                      >
                        Session Date & Time
                      </Label>
                      <Input
                        id="session-date"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(event) => setScheduledAt(event.target.value)}
                        disabled={scheduling}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="session-note"
                        className="text-sm font-medium"
                      >
                        Agenda / Meeting Notes
                      </Label>
                      <Input
                        id="session-note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="e.g. Meeting link or focus topics"
                        disabled={scheduling}
                        className="w-full"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full gap-2 mt-2"
                      disabled={scheduling}
                      variant="default"
                    >
                      {scheduling ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <CalendarClock className="h-4 w-4" />
                      )}
                      {recommendation.mentorship_session_scheduled_at
                        ? "Update Session"
                        : "Schedule Session"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
