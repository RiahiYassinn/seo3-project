"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Clock3,
  Github,
  Link as LinkIcon,
  Loader,
  Loader2,
  Sparkles,
  Send,
  Target,
  TrendingUp,
  Unlink,
  Users,
} from "lucide-react";
import {
  formatLabel,
  recommendationStatusTone,
  recommendationTypeTone,
  type RecommendationCase,
} from "@/app/dashboard/admin/profiles/profile-types";

interface GitHubIntegration {
  id: string;
  github_username: string;
  connected_at: string;
}

interface RepositoryRecord {
  id: string;
  repo_name: string;
}
interface AvailableMentor {
  id: string;
  email: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
  is_mentor: boolean;
  is_active: boolean;
  last_login_at?: string | null;
}

interface MentorRequestRecord {
  id: string;
  recommendation_id: string;
  mentor_id: string;
  status: "pending" | "accepted" | "declined";
  recommendation?: RecommendationCase | null;
}

const getTopIssue = (recommendation: RecommendationCase) => {
  const gap = recommendation.context_snapshot?.detectedGaps?.[0];
  if (gap) {
    return {
      title: gap.label,
      detail: gap.evidence?.[0] || `${formatLabel(gap.severity)} severity gap`,
    };
  }

  const finding = recommendation.evidence_snapshot?.keyFindings?.[0];
  if (finding) {
    return {
      title: finding.title,
      detail: `${formatLabel(finding.skill)} in ${finding.file}`,
    };
  }

  return {
    title: "No specific issue highlighted",
    detail: "Open the recommendation to review the analysis evidence.",
  };
};

const getRecommendationRecap = (recommendation: RecommendationCase) => {
  if (recommendation.learning_path?.steps?.length) {
    const hours = recommendation.learning_path.estimatedTotalHours;
    return `${recommendation.learning_path.steps.length} learning steps${
      typeof hours === "number" ? `, about ${hours}h` : ""
    }`;
  }

  if (recommendation.docs_review?.checklist?.length) {
    return `${recommendation.docs_review.checklist.length} docs review tasks`;
  }

  if (recommendation.recommendation_type === "mentorship") {
    return recommendation.mentor_snapshot?.name
      ? `Mentorship with ${recommendation.mentor_snapshot.name}`
      : "Mentorship recommended";
  }

  return recommendation.description;
};

export default function DeveloperRecommendationsPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [integration, setIntegration] = useState<GitHubIntegration | null>(
    null,
  );
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendationCase[]>(
    [],
  );
  const [repositories, setRepositories] = useState<Record<string, string>>({});
  const [availableMentors, setAvailableMentors] = useState<AvailableMentor[]>(
    [],
  );
  const [mentorRequests, setMentorRequests] = useState<MentorRequestRecord[]>(
    [],
  );
  const [requestingMentorId, setRequestingMentorId] = useState<string | null>(
    null,
  );
  const [ackLoadingId, setAckLoadingId] = useState<string | null>(null);
  const [
    selectedMentorshipRecommendation,
    setSelectedMentorshipRecommendation,
  ] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const integrationResponse = await api.get<GitHubIntegration>(
        "/github/integration",
      );
      setIntegration(integrationResponse.data);
      setUsername(integrationResponse.data.github_username);

      const [
        recommendationResponse,
        repositoryResponse,
        mentorsResponse,
        mentorRequestResponse,
      ] = await Promise.all([
        api.get<RecommendationCase[]>("/recommendations/me"),
        api.get<RepositoryRecord[]>("/github/repositories"),
        api.get<AvailableMentor[]>("/recommendations/mentors/available"),
        api.get<MentorRequestRecord[]>("/recommendations/my-mentor-requests"),
      ]);

      const repoNameMap: Record<string, string> = {};
      for (const repository of repositoryResponse.data || []) {
        repoNameMap[repository.id] = repository.repo_name;
      }

      const nextRecommendations = (recommendationResponse.data || [])
        .slice()
        .sort((left, right) => right.priority_score - left.priority_score);

      setRepositories(repoNameMap);
      setRecommendations(nextRecommendations);
      setAvailableMentors(mentorsResponse.data || []);
      setMentorRequests(mentorRequestResponse.data || []);
      setError("");
    } catch (requestError: any) {
      if (requestError?.response?.status === 404) {
        setIntegration(null);
        setRecommendations([]);
        setRepositories({});
        setAvailableMentors([]);
        setMentorRequests([]);
        setUsername("");
        setError("");
      } else {
        setError(
          requestError?.response?.data?.message ||
            requestError?.message ||
            "Failed to load recommendations",
        );
      }
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, []);

  const handleLinkGitHub = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLinking(true);

    try {
      const { data } = await api.post<GitHubIntegration>(
        "/github/integration",
        {
          github_username: username,
          github_token: token,
        },
      );

      setIntegration(data);
      setUsername(data.github_username);
      setToken("");
      setSuccess("GitHub account linked successfully.");
      await loadData(true);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to link GitHub account",
      );
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkGitHub = async () => {
    if (!integration) return;

    if (
      !confirm(
        "Are you sure you want to unlink your GitHub account? Recommendations will no longer map to this account.",
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");
    setUnlinking(true);

    try {
      await api.delete("/github/integration");
      setIntegration(null);
      setRecommendations([]);
      setRepositories({});
      setToken("");
      setUsername("");
      setSuccess("GitHub account unlinked successfully.");
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to unlink GitHub account",
      );
    } finally {
      setUnlinking(false);
    }
  };

  const acknowledgeRecommendation = async (recommendationId: string) => {
    setAckLoadingId(recommendationId);
    setError("");

    try {
      const { data } = await api.post<RecommendationCase>(
        `/recommendations/${recommendationId}/acknowledge`,
      );

      if (data) {
        setRecommendations((current) =>
          current.map((recommendation) =>
            recommendation.id === recommendationId
              ? { ...recommendation, ...data }
              : recommendation,
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
      setAckLoadingId(null);
    }
  };

  const requestMentor = async (recommendationId: string, mentorId: string) => {
    setRequestingMentorId(`${recommendationId}:${mentorId}`);
    setError("");

    try {
      const { data } = await api.post<{
        request: MentorRequestRecord;
        recommendation?: RecommendationCase;
      }>(`/recommendations/${recommendationId}/request-mentor`, { mentorId });

      if (data?.request) {
        setMentorRequests((current) => {
          const next = current.filter((item) => item.id !== data.request.id);
          return [data.request, ...next];
        });
      }

      if (data?.recommendation) {
        setRecommendations((current) =>
          current.map((recommendation) =>
            recommendation.id === recommendationId
              ? { ...recommendation, ...data.recommendation }
              : recommendation,
          ),
        );
      }

      setSuccess("Mentor request sent successfully!");
      setSelectedMentorshipRecommendation(null);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to request mentoring",
      );
    } finally {
      setRequestingMentorId(null);
    }
  };

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

  const stats = useMemo(() => {
    return {
      total: recommendations.length,
      open: recommendations.filter((item) => item.status === "open").length,
      assigned: recommendations.filter((item) => item.status === "assigned")
        .length,
      completed: recommendations.filter((item) => item.status === "completed")
        .length,
    };
  }, [recommendations]);

  const mentorRequestByRecommendationId = useMemo(() => {
    const map = new Map<string, MentorRequestRecord>();
    for (const request of mentorRequests) {
      if (!map.has(request.recommendation_id)) {
        map.set(request.recommendation_id, request);
      }
    }
    return map;
  }, [mentorRequests]);

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
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
              Developer Workspace
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              GitHub recommendations
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Link your GitHub account, then review compact recommendation
              recaps generated from your analyzed developer activity.
            </p>
          </div>
          {integration ? (
            <Button
              variant="outline"
              onClick={() => loadData(true)}
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
                  Refresh Recommendations
                </>
              )}
            </Button>
          ) : null}
        </div>

        {error ? (
          <Alert className="mb-6 border-destructive/40 bg-destructive/10">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        ) : null}

        {success ? (
          <Alert className="mb-6 border-emerald-500/40 bg-emerald-500/10">
            <AlertDescription className="text-emerald-700">
              {success}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="mb-6 border-border/60 bg-background/85 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Github className="h-5 w-5" />
                  GitHub account
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  This linked username controls which recommendations appear
                  below.
                </p>
              </div>
              {integration ? (
                <Badge
                  variant="outline"
                  className="w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                >
                  Linked
                </Badge>
              ) : (
                <Badge variant="outline" className="w-fit">
                  Not linked
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {integration ? (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Connected account
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    @{integration.github_username}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Linked{" "}
                    {new Date(integration.connected_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2 lg:w-auto"
                  onClick={handleUnlinkGitHub}
                  disabled={unlinking}
                >
                  {unlinking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4" />
                  )}
                  {unlinking ? "Unlinking..." : "Unlink GitHub"}
                </Button>
              </div>
            ) : (
              <form
                className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
                onSubmit={handleLinkGitHub}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">GitHub username</label>
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="your-github-username"
                    required
                    disabled={linking}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">GitHub token</label>
                  <Input
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="github_pat_..."
                    required
                    disabled={linking}
                  />
                </div>
                <Button type="submit" className="gap-2" disabled={linking}>
                  {linking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LinkIcon className="h-4 w-4" />
                  )}
                  {linking ? "Linking..." : "Link GitHub"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {!integration ? (
          <Card className="border-dashed border-border/60 bg-background/70">
            <CardContent className="p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                Recommendations are waiting on GitHub
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Link your GitHub account above to load recommendations mapped to
                your developer activity.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border-border/60 bg-background/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-background/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.open}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-background/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Assigned</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {stats.assigned}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-background/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {stats.completed}
                  </p>
                </CardContent>
              </Card>
            </section>

            {recommendations.length === 0 ? (
              <Card className="border-dashed border-border/60 bg-background/70">
                <CardContent className="p-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold">
                    No recommendations yet
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Recommendations will appear here once analysis is available
                    for your linked account.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {recommendations.map((recommendation) => {
                  const issue = getTopIssue(recommendation);
                  const recommendationRecap =
                    getRecommendationRecap(recommendation);
                  const generatedAt =
                    recommendation.context_snapshot?.generatedAt ||
                    recommendation.created_at;
                  const isMentorship =
                    recommendation.recommendation_type === "mentorship";
                  const request = mentorRequestByRecommendationId.get(
                    recommendation.id,
                  );
                  const requestState = request?.status || null;
                  const scheduledSession =
                    recommendation.mentorship_session_scheduled_at
                      ? new Date(recommendation.mentorship_session_scheduled_at)
                      : null;
                  const scheduledSessionLabel = scheduledSession
                    ? scheduledSession.toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : null;
                  return (
                    <Card
                      key={recommendation.id}
                      className="border-border/70 bg-background/90 shadow-sm transition hover:border-primary/40"
                    >
                      <CardContent className="flex h-full flex-col p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant="outline"
                              className={
                                recommendationTypeTone[
                                  recommendation.recommendation_type
                                ]
                              }
                            >
                              {formatLabel(recommendation.recommendation_type)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={recommendationStatusTone(
                                recommendation.status,
                              )}
                            >
                              {formatLabel(recommendation.status)}
                            </Badge>
                          </div>
                          {recommendation.priority_score ? (
                            <Badge
                              variant="outline"
                              className="border-cyan-500/30 bg-cyan-500/10 text-cyan-700"
                            >
                              Priority:{" "}
                              {Math.round(recommendation.priority_score)}
                            </Badge>
                          ) : null}
                        </div>

                        <h3 className="mt-4 text-lg font-semibold">
                          {recommendation.title}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {repositories[recommendation.repository_id] ||
                            recommendation.context_snapshot?.repoName ||
                            recommendation.repository_id}{" "}
                          · @{recommendation.contributor_login}
                        </p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-border/60 bg-muted/15 p-4">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Target className="h-4 w-4 text-cyan-600" />
                              Issue found
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-medium">
                              {issue.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {issue.detail}
                            </p>
                          </div>

                          <div className="rounded-lg border border-border/60 bg-muted/15 p-4">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                              Recommendation
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm leading-5 text-muted-foreground">
                              {recommendationRecap}
                            </p>
                          </div>
                        </div>

                        {isMentorship && scheduledSessionLabel ? (
                          <div className="mt-4 rounded-lg border border-violet-500/25 bg-violet-500/10 p-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-violet-700">
                              <CalendarClock className="h-4 w-4" />
                              Mentoring session
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {scheduledSessionLabel}
                            </p>
                            {recommendation.mentorship_session_note ? (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {recommendation.mentorship_session_note}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span>
                            Confidence{" "}
                            <span className="font-medium text-foreground">
                              {typeof recommendation.confidence_score ===
                              "number"
                                ? `${Math.round(
                                    recommendation.confidence_score * 100,
                                  )}%`
                                : "--"}
                            </span>
                          </span>
                          <span>
                            Effort{" "}
                            <span className="font-medium text-foreground">
                              {recommendation.effort_level
                                ? formatLabel(recommendation.effort_level)
                                : "--"}
                            </span>
                          </span>
                          {generatedAt ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" />
                              {new Date(generatedAt).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-5 flex flex-col gap-2 sm:mt-auto sm:flex-row sm:items-center sm:justify-between sm:pt-5">
                          <Button asChild variant="outline" className="gap-2">
                            <Link
                              href={`/dashboard/developer/recommendations/${recommendation.id}`}
                            >
                              View details
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                          <div className="flex gap-2">
                            {isMentorship && !recommendation.mentor_id ? (
                              <Button
                                type="button"
                                variant="secondary"
                                className="gap-2"
                                onClick={() =>
                                  setSelectedMentorshipRecommendation(
                                    recommendation.id,
                                  )
                                }
                              >
                                <Users className="h-4 w-4" />
                                {requestState ? "Pending" : "Select mentor"}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              className="gap-2"
                              variant={
                                recommendation.status === "completed"
                                  ? "outline"
                                  : "default"
                              }
                              disabled={
                                recommendation.status === "completed" ||
                                ackLoadingId === recommendation.id
                              }
                              onClick={() =>
                                acknowledgeRecommendation(recommendation.id)
                              }
                            >
                              {ackLoadingId === recommendation.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : recommendation.status === "completed" ? (
                                <CircleCheck className="h-4 w-4" />
                              ) : null}
                              {recommendation.status === "completed"
                                ? "Completed"
                                : "Mark completed"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <Dialog
        open={selectedMentorshipRecommendation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMentorshipRecommendation(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select a mentor</DialogTitle>
            <DialogDescription>
              Choose an available mentor to send a mentorship request
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {availableMentors.length > 0 ? (
              availableMentors.map((mentor) => {
                const mentorName =
                  [mentor.first_name, mentor.last_name]
                    .filter(Boolean)
                    .join(" ") ||
                  mentor.username ||
                  mentor.email;
                const isRequesting =
                  requestingMentorId ===
                  `${selectedMentorshipRecommendation}:${mentor.id}`;
                const hasExistingRequest = mentorRequests.some(
                  (item) =>
                    item.recommendation_id ===
                      selectedMentorshipRecommendation &&
                    item.mentor_id === mentor.id,
                );
                const isDisabled = isRequesting || hasExistingRequest;

                return (
                  <button
                    key={mentor.id}
                    type="button"
                    onClick={() => {
                      if (selectedMentorshipRecommendation) {
                        requestMentor(
                          selectedMentorshipRecommendation,
                          mentor.id,
                        );
                      }
                    }}
                    disabled={isDisabled}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      isDisabled
                        ? "cursor-not-allowed border-border/50 bg-muted/10 opacity-60"
                        : "border-border/60 bg-muted/10 hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">
                          {mentorName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          @{mentor.username || mentor.email}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">
                            {formatLabel(mentor.role)}
                          </Badge>
                          {mentor.last_login_at && (
                            <Badge variant="outline" className="text-xs">
                              Active{" "}
                              {new Date(
                                mentor.last_login_at,
                              ).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {isRequesting ? (
                        <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <Send className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No mentors are currently available
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
