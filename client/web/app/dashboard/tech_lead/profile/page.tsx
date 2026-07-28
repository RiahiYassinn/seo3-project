"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  CircleCheck,
  Clock3,
  Loader2,
  UserRoundPlus,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import {
  ProfileWorkspace,
  type ProfileStat,
} from "@/components/profile/profile-workspace";
import api from "@/lib/api";
import { authAPI } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface MentorRequestRecord {
  id: string;
  status: "pending" | "accepted" | "declined";
}

export default function TechLeadProfilePage() {
  const router = useRouter();
  const { user, hasHydrated, updateUser } = useAuthStore();

  const [queueSize, setQueueSize] = useState(0);
  const [mentorRequests, setMentorRequests] = useState<MentorRequestRecord[]>(
    [],
  );
  const [statsLoading, setStatsLoading] = useState(true);
  const [mentorAvailable, setMentorAvailable] = useState(
    Boolean(user?.is_mentor),
  );
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");

  useEffect(() => {
    setMentorAvailable(Boolean(user?.is_mentor));
  }, [user?.is_mentor]);

  const loadMentorship = useCallback(async () => {
    try {
      const [queueResponse, requestResponse] = await Promise.all([
        api.get<unknown[]>("/recommendations/mentor-queue"),
        api.get<MentorRequestRecord[]>("/recommendations/mentor-requests"),
      ]);

      setQueueSize((queueResponse.data || []).length);
      setMentorRequests(requestResponse.data || []);
    } catch {
      setQueueSize(0);
      setMentorRequests([]);
    } finally {
      setStatsLoading(false);
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

    loadMentorship();
  }, [hasHydrated, loadMentorship, router, user]);

  const toggleAvailability = async (nextValue: boolean) => {
    setMentorAvailable(nextValue);
    setUpdatingAvailability(true);
    setAvailabilityError("");

    try {
      const response = await authAPI.updateMentorAvailability(nextValue);
      updateUser({ is_mentor: response.user.is_mentor });
    } catch (requestError: any) {
      setMentorAvailable(!nextValue);
      setAvailabilityError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to update your availability",
      );
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const pending = mentorRequests.filter(
    (request) => request.status === "pending",
  ).length;
  const accepted = mentorRequests.filter(
    (request) => request.status === "accepted",
  ).length;

  const stats: ProfileStat[] = [
    {
      label: "Pending requests",
      value: pending,
      icon: Clock3,
      hint: "Waiting for your answer",
    },
    {
      label: "Active mentees",
      value: accepted,
      icon: UserRoundPlus,
      hint: "Requests you accepted",
    },
    {
      label: "Mentor queue",
      value: queueSize,
      icon: BriefcaseBusiness,
      hint: "Cases needing a mentor",
    },
  ];

  if (!hasHydrated || !user) {
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

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
            Tech lead workspace
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">My profile</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Your details, your mentoring availability, and where your mentorship
            queue currently stands.
          </p>
        </header>

        <ProfileWorkspace stats={stats} statsLoading={statsLoading}>
          <Card className="border-border/60 bg-background/85 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserRoundPlus className="h-4 w-4" />
                Mentoring availability
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Developers can only send you a request while this is on.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <div>
                  <Label htmlFor="mentor-availability" className="text-sm font-medium">
                    Available for mentorship
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {mentorAvailable
                      ? "You appear in the mentor list developers pick from."
                      : "You are hidden from the mentor list."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {updatingAvailability ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : null}
                  <Switch
                    id="mentor-availability"
                    checked={mentorAvailable}
                    disabled={updatingAvailability}
                    onCheckedChange={toggleAvailability}
                  />
                </div>
              </div>

              {availabilityError ? (
                <p className="text-sm text-destructive">{availabilityError}</p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {pending > 0
                    ? `${pending} request${pending === 1 ? "" : "s"} waiting for a decision.`
                    : "No requests are waiting on you right now."}
                </p>
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/dashboard/tech_lead/recommendations">
                    Open mentor queue
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {accepted > 0 ? (
            <Card className="border-emerald-500/25 bg-emerald-500/[0.05] shadow-sm">
              <CardContent className="flex items-center gap-3 p-5 text-sm">
                <CircleCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  You are actively mentoring on{" "}
                  <span className="font-semibold">{accepted}</span>{" "}
                  {accepted === 1 ? "recommendation" : "recommendations"}.
                </span>
              </CardContent>
            </Card>
          ) : null}
        </ProfileWorkspace>
      </main>
    </div>
  );
}
