"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  CircleAlert,
  FolderGit2,
  Github,
  Sparkles,
  Target,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ContributorProfile,
  type RepositoryRecord,
  formatLabel,
  normalizeContributorAnalysisSummary,
} from "../profiles/profile-types";
import { buildAdminWorkflowHref } from "@/lib/admin-workflow";
import { cn } from "@/lib/utils";

type SeverityTotals = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
};

/**
 * Severity is a status scale, so it uses the reserved status steps rather than
 * categorical series hues, and every segment is labelled with its name and
 * count — colour never carries the meaning on its own.
 */
const SEVERITY_BANDS = [
  { key: "critical", label: "Critical", color: "var(--viz-critical)" },
  { key: "high", label: "High", color: "var(--viz-serious)" },
  { key: "medium", label: "Medium", color: "var(--viz-warning)" },
  { key: "low", label: "Low", color: "var(--viz-neutral)" },
] as const;

const STATUS_BANDS: Record<string, { label: string; color: string }> = {
  completed: { label: "Completed", color: "var(--viz-good)" },
  in_progress: { label: "In progress", color: "var(--viz-series-1)" },
  pending: { label: "Pending", color: "var(--viz-warning)" },
  failed: { label: "Failed", color: "var(--viz-critical)" },
  unknown: { label: "Unknown", color: "var(--viz-neutral)" },
};

const QUALITY_BANDS = [
  { key: "0-3", label: "0-3", min: 0, max: 3 },
  { key: "3-5", label: "3-5", min: 3, max: 5 },
  { key: "5-7", label: "5-7", min: 5, max: 7 },
  { key: "7-8.5", label: "7-8.5", min: 7, max: 8.5 },
  { key: "8.5-10", label: "8.5-10", min: 8.5, max: 10.0001 },
];

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

/** Tooltip styled with app tokens so it reads correctly in dark mode too. */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string | number;
  unit: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">
          {payload[0]?.value ?? 0}
        </span>{" "}
        {unit}
      </p>
    </div>
  );
}

/** Part-to-whole bar: 2px surface gaps between fills, no borders on marks. */
function StackedShareBar({
  segments,
  total,
}: {
  segments: Array<{ key: string; label: string; color: string; value: number }>;
  total: number;
}) {
  const visible = segments.filter((segment) => segment.value > 0);

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {visible.length ? (
          visible.map((segment) => (
            <span
              key={segment.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(segment.value / total) * 100}%`,
                backgroundColor: segment.color,
              }}
            />
          ))
        ) : (
          <span className="h-full w-full rounded-full bg-muted" />
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((segment) => (
          <span
            key={segment.key}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            {segment.label}
            <span className="font-semibold text-foreground tabular-nums">
              {segment.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Single ratio against a limit → meter, not a two-slice pie. */
function Meter({ value, tone }: { value: number; tone?: string }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          backgroundColor: tone || "var(--viz-series-1)",
        }}
      />
    </div>
  );
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRepositories = async () => {
      try {
        const { data } = await api.get<RepositoryRecord[]>(
          "/github/repositories",
        );
        setRepositories(data || []);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ??
            err.message ??
            "Failed to load admin overview",
        );
      } finally {
        setLoading(false);
      }
    };

    loadRepositories();
  }, []);

  const contributorProfiles = useMemo<ContributorProfile[]>(() => {
    return repositories
      .flatMap((repository) =>
        Object.values(repository.analysis_metadata?.contributorProfiles || {}),
      )
      .sort((left, right) => {
        const leftTime = left.analyzedAt
          ? new Date(left.analyzedAt).getTime()
          : 0;
        const rightTime = right.analyzedAt
          ? new Date(right.analyzedAt).getTime()
          : 0;
        return rightTime - leftTime;
      });
  }, [repositories]);

  const analytics = useMemo(() => {
    const qualityValues = contributorProfiles
      .map((profile) => profile.qualityScore)
      .filter((value): value is number => typeof value === "number");

    const avgQuality = qualityValues.length
      ? qualityValues.reduce((sum, value) => sum + value, 0) /
        qualityValues.length
      : 0;

    const statusCounts = contributorProfiles.reduce<Record<string, number>>(
      (acc, profile) => {
        const key = profile.status || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {},
    );

    const statusSegments = Object.entries(statusCounts)
      .map(([status, count]) => ({
        key: status,
        label: STATUS_BANDS[status]?.label || formatLabel(status),
        color: STATUS_BANDS[status]?.color || STATUS_BANDS.unknown.color,
        value: count,
      }))
      .sort((left, right) => right.value - left.value);

    const severityTotals = contributorProfiles.reduce<SeverityTotals>(
      (acc, profile) => {
        const normalizedSummary = normalizeContributorAnalysisSummary(
          profile.analysisSummary ?? profile.metadata?.analysisSummary ?? null,
        );

        const critical =
          normalizedSummary?.summary?.critical_count ??
          profile.findingsSummary?.critical_count ??
          0;
        const high =
          normalizedSummary?.summary?.high_count ??
          profile.findingsSummary?.high_count ??
          0;
        const medium =
          normalizedSummary?.summary?.medium_count ??
          profile.findingsSummary?.medium_count ??
          0;
        const low =
          normalizedSummary?.summary?.low_count ??
          profile.findingsSummary?.low_count ??
          0;
        const findingCount =
          normalizedSummary?.summary?.finding_count ??
          profile.findingsSummary?.finding_count ??
          critical + high + medium + low;

        acc.critical += critical;
        acc.high += high;
        acc.medium += medium;
        acc.low += low;
        acc.total += findingCount;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
    );

    const severitySegments = SEVERITY_BANDS.map((band) => ({
      key: band.key,
      label: band.label,
      color: band.color,
      value: severityTotals[band.key],
    }));

    const qualityDistributionData = QUALITY_BANDS.map((band) => ({
      band: band.label,
      count: qualityValues.filter(
        (value) => value >= band.min && value < band.max,
      ).length,
    }));

    const weaknessCounts = contributorProfiles.reduce<Record<string, number>>(
      (acc, profile) => {
        for (const weakness of profile.topWeaknesses || []) {
          const key = String(weakness.category || "unknown").trim();
          if (!key) continue;
          acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
      },
      {},
    );

    const topWeaknessData = Object.entries(weaknessCounts)
      .map(([category, count]) => ({ category: formatLabel(category), count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 7);

    const repoRollup = repositories
      .map((repo) => {
        const repoProfiles = Object.values(
          repo.analysis_metadata?.contributorProfiles || {},
        );
        const completed = repoProfiles.filter(
          (profile) => profile.status === "completed",
        ).length;
        const repoQualityValues = repoProfiles
          .map((profile) => profile.qualityScore)
          .filter((value): value is number => typeof value === "number");
        const avgRepoQuality = repoQualityValues.length
          ? repoQualityValues.reduce((sum, value) => sum + value, 0) /
            repoQualityValues.length
          : null;

        return {
          repoId: repo.id,
          repoName: repo.repo_name,
          profileCount: repoProfiles.length,
          completed,
          avgQuality: avgRepoQuality,
        };
      })
      .filter((repo) => repo.profileCount > 0)
      .sort((left, right) => right.profileCount - left.profileCount)
      .slice(0, 5);

    const completionRate = contributorProfiles.length
      ? (statusCounts.completed || 0) / contributorProfiles.length
      : 0;

    return {
      statusCounts,
      statusSegments,
      severityTotals,
      severitySegments,
      qualityDistributionData,
      topWeaknessData,
      repoRollup,
      avgQuality,
      completionRate,
    };
  }, [contributorProfiles, repositories]);

  const needsAttention =
    analytics.severityTotals.critical + analytics.severityTotals.high;
  const severeShare = analytics.severityTotals.total
    ? Math.round((needsAttention / analytics.severityTotals.total) * 100)
    : 0;

  const kpis = [
    {
      label: "Repositories",
      value: repositories.length,
      hint: "connected to the workspace",
      icon: Github,
    },
    {
      label: "Contributor profiles",
      value: contributorProfiles.length,
      hint: "generated across all repos",
      icon: Users,
    },
    {
      label: "Analysis completion",
      value: `${Math.round(analytics.completionRate * 100)}%`,
      hint: `${analytics.statusCounts.completed || 0} of ${contributorProfiles.length} profiles`,
      icon: Target,
      meter: analytics.completionRate * 100,
    },
    {
      label: "Average quality",
      value: analytics.avgQuality ? analytics.avgQuality.toFixed(1) : "--",
      hint: "across analyzed contributors",
      icon: Zap,
      meter: (analytics.avgQuality / 10) * 100,
    },
  ];

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => router.push("/dashboard/admin/github")}
        className="gap-2"
      >
        <Github className="h-4 w-4" />
        Run analysis
      </Button>
      <Button
        onClick={() => router.push("/dashboard/admin/profiles")}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Review profiles
      </Button>
    </div>
  );

  if (loading) {
    return (
      <AdminShell
        title="Overview"
        subtitle="Analysis coverage, quality outcomes, and where coaching effort should go next."
      >
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="h-52 animate-pulse rounded-2xl bg-muted" />
            <div className="grid grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((tile) => (
                <div
                  key={tile}
                  className="h-24 animate-pulse rounded-2xl bg-muted"
                />
              ))}
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="h-80 animate-pulse rounded-2xl bg-muted" />
            <div className="h-80 animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      </AdminShell>
    );
  }

  /* A fresh workspace gets one instruction, not six zeroed tiles. */
  if (!error && contributorProfiles.length === 0) {
    return (
      <AdminShell
        title="Overview"
        subtitle="Analysis coverage, quality outcomes, and where coaching effort should go next."
        actions={headerActions}
      >
        <Card className="border-dashed border-border/60 bg-background/80">
          <CardContent className="p-14 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BarChart3 className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">
              No analysis data yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {repositories.length === 0
                ? "Link the admin GitHub account and sync repositories to start building contributor profiles."
                : `${repositories.length} repositories are connected. Run contributor analysis on one to populate this overview.`}
            </p>
            <Button
              className="mt-6 gap-2"
              onClick={() => router.push("/dashboard/admin/github")}
            >
              Go to GitHub analysis
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Overview"
      subtitle="Analysis coverage, quality outcomes, and where coaching effort should go next."
      actions={headerActions}
    >
      {error && (
        <Alert className="mb-6 border-destructive/40 bg-destructive/10">
          <CircleAlert className="h-4 w-4" />
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* ------------------------- Lead: what needs action ------------------------- */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden border-border/60 bg-background/85 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TriangleAlert className="h-4 w-4" />
                  Needs attention
                </p>
                {/* Hero figure: system sans, proportional figures. */}
                <p className="mt-3 text-6xl font-bold leading-none tracking-tight">
                  {needsAttention}
                </p>
                <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                  Critical and high severity findings across{" "}
                  {contributorProfiles.length} contributor profiles —{" "}
                  {severeShare}% of all {analytics.severityTotals.total} issues
                  detected.
                </p>
              </div>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => router.push("/dashboard/admin/recommendations")}
              >
                Review recommendations
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-6 border-t border-border/60 pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Severity mix
              </p>
              <StackedShareBar
                segments={analytics.severitySegments}
                total={Math.max(1, analytics.severityTotals.total)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {kpis.map((kpi) => (
            <Card
              key={kpi.label}
              className="border-border/60 bg-background/80 shadow-sm"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <kpi.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                </div>
                <p className="mt-2 text-3xl font-semibold leading-none">
                  {kpi.value}
                </p>
                {typeof kpi.meter === "number" ? (
                  <Meter value={kpi.meter} />
                ) : null}
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {kpi.hint}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ------------------------------- Charts ------------------------------- */}
      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="border-border/60 bg-background/85 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Quality score distribution
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              How many contributor profiles fall in each quality band (0–10).
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[16rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.qualityDistributionData}
                  margin={{ top: 8, left: 0, right: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--viz-grid)"
                    strokeWidth={1}
                  />
                  <XAxis
                    dataKey="band"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--viz-axis)", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    allowDecimals={false}
                    tick={{ fill: "var(--viz-axis)", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--viz-grid)", fillOpacity: 0.4 }}
                    content={<ChartTooltip unit="profiles" />}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--viz-series-1)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={56}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Average quality</span>
              <span className="font-semibold">
                {analytics.avgQuality
                  ? `${analytics.avgQuality.toFixed(2)}/10`
                  : "--"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/85 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Most common weaknesses</CardTitle>
            <p className="text-sm text-muted-foreground">
              Categories flagged most often across generated profiles.
            </p>
          </CardHeader>
          <CardContent>
            {analytics.topWeaknessData.length ? (
              <div className="h-[16rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.topWeaknessData}
                    layout="vertical"
                    margin={{ top: 4, left: 0, right: 16, bottom: 4 }}
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke="var(--viz-grid)"
                      strokeWidth={1}
                    />
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tickLine={false}
                      axisLine={false}
                      width={128}
                      tick={{ fill: "var(--viz-axis)", fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--viz-grid)", fillOpacity: 0.4 }}
                      content={<ChartTooltip unit="profiles affected" />}
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--viz-series-1)"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={22}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[16rem] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 text-center">
                <p className="text-sm font-medium">No weakness data yet</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Categories appear once profiles include weakness summaries.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ------------------------------ Breakdown ------------------------------ */}
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/60 bg-background/85 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Repository coverage</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Where profiles have been generated so far.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => router.push("/dashboard/admin/github")}
              >
                All repositories
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {analytics.repoRollup.length ? (
              analytics.repoRollup.map((repo) => {
                const completion = repo.profileCount
                  ? (repo.completed / repo.profileCount) * 100
                  : 0;

                return (
                  <button
                    key={repo.repoName}
                    type="button"
                    onClick={() =>
                      router.push(
                        buildAdminWorkflowHref("/dashboard/admin/profiles", {
                          repoId: repo.repoId,
                          repoName: repo.repoName,
                        }),
                      )
                    }
                    className="group w-full rounded-xl border border-border/60 bg-muted/15 p-4 text-left transition-colors hover:border-primary/35 hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="inline-flex min-w-0 items-center gap-2 font-medium">
                        <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{repo.repoName}</span>
                      </p>
                      <Badge variant="outline" className="shrink-0">
                        {repo.profileCount} profile
                        {repo.profileCount === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${completion}%`,
                            backgroundColor: "var(--viz-good)",
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {repo.completed}/{repo.profileCount} complete
                        {repo.avgQuality !== null
                          ? ` · ${repo.avgQuality.toFixed(1)}/10 avg`
                          : ""}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                Repository coverage appears once contributor profiles are
                generated.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/85 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Profile run status</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Execution state of every analysis run.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <StackedShareBar
              segments={analytics.statusSegments}
              total={Math.max(1, contributorProfiles.length)}
            />

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Recently analyzed
              </p>
              <div className="space-y-1">
                {contributorProfiles
                  .filter((profile) => !!profile.analyzedAt)
                  .slice(0, 5)
                  .map((profile) => (
                    <button
                      key={`${profile.repositoryName}-${profile.contributorLogin}`}
                      type="button"
                      onClick={() =>
                        router.push(
                          buildAdminWorkflowHref(
                            `/dashboard/admin/profiles/${encodeURIComponent(profile.profileId)}`,
                            {
                              repoId: profile.repositoryId,
                              repoName: profile.repositoryName,
                              contributorLogin: profile.contributorLogin,
                              profileId: profile.profileId,
                            },
                          ),
                        )
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          @{profile.contributorLogin}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {profile.repositoryName}
                          {profile.analyzedAt
                            ? ` · ${shortDate(profile.analyzedAt)}`
                            : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          typeof profile.qualityScore !== "number"
                            ? "text-muted-foreground"
                            : profile.qualityScore < 4
                              ? "text-rose-600 dark:text-rose-400"
                              : profile.qualityScore < 7
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {typeof profile.qualityScore === "number"
                          ? `${profile.qualityScore}/10`
                          : "--"}
                      </span>
                    </button>
                  ))}

                {contributorProfiles.filter((profile) => !!profile.analyzedAt)
                  .length === 0 && (
                  <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                    Analyzed contributors will appear here after the first run.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}
