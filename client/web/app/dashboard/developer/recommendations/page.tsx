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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Clock3,
  Flame,
  Github,
  Inbox,
  Link as LinkIcon,
  Loader,
  Loader2,
  Search,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Unlink,
  Users,
  X,
} from "lucide-react";
import {
  formatLabel,
  priorityBand,
  recommendationStatusTone,
  recommendationTypeTone,
  type RecommendationCase,
} from "@/app/dashboard/admin/profiles/profile-types";
import { cn } from "@/lib/utils";

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

type StatusFilter = "all" | "open" | "assigned" | "completed";
type SortMode = "priority" | "recent";

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
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
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

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("priority");

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
      setConfirmingUnlink(false);
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

  const availableTypes = useMemo(
    () =>
      Array.from(
        new Set(recommendations.map((item) => item.recommendation_type)),
      ),
    [recommendations],
  );

  const visibleRecommendations = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = recommendations.filter((recommendation) => {
      if (statusFilter !== "all" && recommendation.status !== statusFilter) {
        return false;
      }

      if (
        typeFilter !== "all" &&
        recommendation.recommendation_type !== typeFilter
      ) {
        return false;
      }

      if (!term) return true;

      return [
        recommendation.title,
        recommendation.description,
        recommendation.contributor_login,
        repositories[recommendation.repository_id],
        recommendation.context_snapshot?.repoName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });

    return filtered.sort((left, right) =>
      sortMode === "priority"
        ? right.priority_score - left.priority_score
        : new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
    );
  }, [
    recommendations,
    repositories,
    search,
    sortMode,
    statusFilter,
    typeFilter,
  ]);

  const filtersActive =
    statusFilter !== "all" || typeFilter !== "all" || search.trim() !== "";

  const resetFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setSearch("");
  };

  const mentorRequestByRecommendationId = useMemo(() => {
    const map = new Map<string, MentorRequestRecord>();
    for (const request of mentorRequests) {
      if (!map.has(request.recommendation_id)) {
        map.set(request.recommendation_id, request);
      }
    }
    return map;
  }, [mentorRequests]);

  const statusFilterOptions: Array<{
    value: StatusFilter;
    label: string;
    count: number;
  }> = [
    { value: "all", label: "All", count: stats.total },
    { value: "open", label: "Open", count: stats.open },
    { value: "assigned", label: "In progress", count: stats.assigned },
    { value: "completed", label: "Completed", count: stats.completed },
  ];

  if (!hasHydrated || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-10 w-80 animate-pulse rounded bg-muted" />
          <div className="mt-8 h-20 animate-pulse rounded-2xl bg-muted" />
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((card) => (
              <div
                key={card}
                className="h-64 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.08),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_30%)]">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
              Developer workspace
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Your recommendations
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              What the analysis found in your contributions, ranked by impact —
              with a learning path or a mentor attached to each one.
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
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          ) : null}
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

        {success ? (
          <Alert className="mb-6 border-emerald-500/40 bg-emerald-500/10">
            <CircleCheck className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-300">
              <span>{success}</span>
              <button
                type="button"
                onClick={() => setSuccess("")}
                aria-label="Dismiss"
                className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </AlertDescription>
          </Alert>
        ) : null}

        {!integration ? (
          /* ---------------------- Not linked: setup only ---------------------- */
          <Card className="mx-auto max-w-2xl overflow-hidden border-border/60 bg-background/85 shadow-sm">
            <div
              aria-hidden="true"
              className="h-1 w-full bg-gradient-to-r from-primary via-cyan-500 to-primary/20"
            />
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Github className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle>Connect GitHub to get recommendations</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your linked account decides which contributions are
                    analyzed. Nothing else to install.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleLinkGitHub}>
                <div className="space-y-2">
                  <label htmlFor="gh-username" className="text-sm font-medium">
                    GitHub username
                  </label>
                  <Input
                    id="gh-username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="your-github-username"
                    required
                    disabled={linking}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="gh-token" className="text-sm font-medium">
                    GitHub token
                  </label>
                  <Input
                    id="gh-token"
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="github_pat_..."
                    required
                    disabled={linking}
                  />
                  <p className="text-xs text-muted-foreground">
                    A personal access token with read access to the repositories
                    you contribute to.
                  </p>
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
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ------------------- Linked: compact account strip ------------------- */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Github className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    @{integration.github_username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Linked{" "}
                    {new Date(integration.connected_at).toLocaleDateString()} ·{" "}
                    {Object.keys(repositories).length} repositories analyzed
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmingUnlink(true)}
                disabled={unlinking}
              >
                {unlinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
                Unlink
              </Button>
            </div>

            {/* ------------------------------ Toolbar ------------------------------ */}
            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-0.5">
                {statusFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      statusFilter === option.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                    <span
                      className={cn(
                        "ml-1.5 text-xs",
                        statusFilter === option.value
                          ? "font-semibold text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {option.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative sm:w-60">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search recommendations"
                    className="pl-9"
                    aria-label="Search recommendations"
                  />
                </div>

                {availableTypes.length > 1 ? (
                  <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-0.5">
                    <button
                      type="button"
                      onClick={() => setTypeFilter("all")}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                        typeFilter === "all"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      All types
                    </button>
                    {availableTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setTypeFilter(type)}
                        className={cn(
                          "rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                          typeFilter === type
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {formatLabel(type)}
                      </button>
                    ))}
                  </div>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    setSortMode((current) =>
                      current === "priority" ? "recent" : "priority",
                    )
                  }
                  title="Change sort order"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  {sortMode === "priority" ? "By priority" : "Newest first"}
                </Button>

                {filtersActive ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>

            {/* ---------------------------- Feed ---------------------------- */}
            {recommendations.length === 0 ? (
              <Card className="border-dashed border-border/60 bg-background/70">
                <CardContent className="p-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold">
                    No recommendations yet
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Once an admin runs the analysis on a repository you
                    contribute to, your recommendations will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : visibleRecommendations.length === 0 ? (
              <Card className="border-dashed border-border/60 bg-background/70">
                <CardContent className="p-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Inbox className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold">
                    Nothing matches these filters
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Try a different search term, or clear the filters to see all{" "}
                    {stats.total} recommendations.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-5"
                    onClick={resetFilters}
                  >
                    Clear filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {visibleRecommendations.map((recommendation) => {
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
                  const isCompleted = recommendation.status === "completed";
                  const band = priorityBand(recommendation.priority_score || 0);
                  const confidence =
                    typeof recommendation.confidence_score === "number"
                      ? Math.round(recommendation.confidence_score * 100)
                      : null;

                  return (
                    <Card
                      key={recommendation.id}
                      className={cn(
                        "relative overflow-hidden border-border/70 bg-background/90 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md motion-reduce:hover:translate-y-0",
                        isCompleted && "opacity-75",
                      )}
                    >
                      {/* Priority rail */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-y-0 left-0 w-1",
                          isCompleted ? "bg-emerald-500" : band.rail,
                        )}
                      />

                      <CardContent className="flex h-full flex-col p-5 pl-6">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5">
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
                              className={cn("gap-1", band.badge)}
                              title={`Priority score ${Math.round(
                                recommendation.priority_score,
                              )}`}
                            >
                              <Flame className="h-3 w-3" />
                              {band.label}
                            </Badge>
                          ) : null}
                        </div>

                        <h3 className="mt-4 text-lg font-semibold leading-6">
                          {recommendation.title}
                        </h3>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          {repositories[recommendation.repository_id] ||
                            recommendation.context_snapshot?.repoName ||
                            recommendation.repository_id}{" "}
                          · @{recommendation.contributor_login}
                        </p>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <Target className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                              Issue found
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-medium leading-5">
                              {issue.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {issue.detail}
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              What to do
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm leading-5 text-muted-foreground">
                              {recommendationRecap}
                            </p>
                          </div>
                        </div>

                        {isMentorship && scheduledSessionLabel ? (
                          <div className="mt-4 rounded-xl border border-violet-500/25 bg-violet-500/10 p-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                              <CalendarClock className="h-4 w-4" />
                              Mentoring session
                            </div>
                            <p className="mt-1.5 text-sm text-muted-foreground">
                              {scheduledSessionLabel}
                            </p>
                            {recommendation.mentorship_session_note ? (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {recommendation.mentorship_session_note}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                          {confidence !== null ? (
                            <span className="inline-flex items-center gap-2">
                              Confidence
                              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
                                <span
                                  className="block h-full rounded-full bg-primary"
                                  style={{ width: `${confidence}%` }}
                                />
                              </span>
                              <span className="font-medium text-foreground">
                                {confidence}%
                              </span>
                            </span>
                          ) : null}
                          {recommendation.effort_level ? (
                            <span>
                              Effort{" "}
                              <span className="font-medium capitalize text-foreground">
                                {formatLabel(recommendation.effort_level)}
                              </span>
                            </span>
                          ) : null}
                          {generatedAt ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" />
                              {new Date(generatedAt).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-5 flex flex-col gap-2 border-t border-border/60 pt-4 sm:mt-auto sm:flex-row sm:items-center sm:justify-between">
                          <Button asChild className="gap-2">
                            <Link
                              href={`/dashboard/developer/recommendations/${recommendation.id}`}
                            >
                              View details
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>

                          <div className="flex flex-wrap gap-2">
                            {isMentorship && !recommendation.mentor_id ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="gap-2"
                                disabled={Boolean(requestState)}
                                onClick={() =>
                                  setSelectedMentorshipRecommendation(
                                    recommendation.id,
                                  )
                                }
                              >
                                <Users className="h-4 w-4" />
                                {requestState === "pending"
                                  ? "Request pending"
                                  : requestState === "declined"
                                    ? "Request declined"
                                    : requestState === "accepted"
                                      ? "Mentor assigned"
                                      : "Find a mentor"}
                              </Button>
                            ) : null}
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

      {/* --------------------------- Mentor picker --------------------------- */}
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
            <DialogTitle>Choose a mentor</DialogTitle>
            <DialogDescription>
              They will see the gap and the evidence behind it before deciding.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
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
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition",
                      isDisabled
                        ? "cursor-not-allowed border-border/50 bg-muted/10 opacity-60"
                        : "border-border/60 bg-muted/10 hover:border-primary/40 hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-foreground">
                          {mentorName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          @{mentor.username || mentor.email}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">
                            {formatLabel(mentor.role)}
                          </Badge>
                          {hasExistingRequest ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300"
                            >
                              Already requested
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {isRequesting ? (
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <Send className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">
                  No mentors are available
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tech leads appear here once they turn on their mentoring
                  availability.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* --------------------------- Unlink confirm --------------------------- */}
      <AlertDialog open={confirmingUnlink} onOpenChange={setConfirmingUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink your GitHub account?</AlertDialogTitle>
            <AlertDialogDescription>
              Recommendations will stop mapping to this account and disappear
              from this page until you link it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlinkGitHub}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
