"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart3,
  CircleAlert,
  Flame,
  Github,
  PieChart as PieChartIcon,
  Sparkles,
  Target,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ContributorProfile,
  type RepositoryRecord,
  normalizeContributorAnalysisSummary,
} from "../profiles/profile-types";

type SeverityTotals = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
};

const STATUS_COLORS: Record<string, string> = {
  completed: "#16a34a",
  in_progress: "#f59e0b",
  pending: "#d97706",
  failed: "#dc2626",
  unknown: "#6b7280",
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

const toStatusLabel = (value: string) =>
  String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

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

    const statusChartData = Object.entries(statusCounts)
      .map(([status, count]) => ({
        status,
        label: toStatusLabel(status),
        count,
        fill: STATUS_COLORS[status] || STATUS_COLORS.unknown,
      }))
      .sort((left, right) => right.count - left.count);

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

    const severityChartData = [
      { severity: "Critical", value: severityTotals.critical, fill: "#dc2626" },
      { severity: "High", value: severityTotals.high, fill: "#ea580c" },
      { severity: "Medium", value: severityTotals.medium, fill: "#f59e0b" },
      { severity: "Low", value: severityTotals.low, fill: "#2563eb" },
    ];

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
      .map(([category, count]) => ({ category, count }))
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
          repoName: repo.repo_name,
          profileCount: repoProfiles.length,
          completed,
          avgQuality: avgRepoQuality,
        };
      })
      .sort((left, right) => right.profileCount - left.profileCount)
      .slice(0, 6);

    const completionRate = contributorProfiles.length
      ? (statusCounts.completed || 0) / contributorProfiles.length
      : 0;

    return {
      statusCounts,
      statusChartData,
      severityTotals,
      severityChartData,
      qualityDistributionData,
      topWeaknessData,
      repoRollup,
      avgQuality,
      completionRate,
    };
  }, [contributorProfiles, repositories]);

  const stats = [
    {
      label: "Repositories monitored",
      value: repositories.length,
      hint: "GitHub repositories available in admin workspace",
      icon: Github,
    },
    {
      label: "Contributor profiles",
      value: contributorProfiles.length,
      hint: "Generated skill profiles across all repositories",
      icon: Users,
    },
    {
      label: "Analysis completion",
      value: `${Math.round(analytics.completionRate * 100)}%`,
      hint: "Completed profiles out of all tracked contributors",
      icon: Target,
    },
    {
      label: "Average quality score",
      value: analytics.avgQuality ? analytics.avgQuality.toFixed(1) : "--",
      hint: "Average quality score (0-10) for analyzed contributors",
      icon: Zap,
    },
    {
      label: "Total findings",
      value: analytics.severityTotals.total,
      hint: "Issues detected across all generated profiles",
      icon: BarChart3,
    },
    {
      label: "Critical + high",
      value: analytics.severityTotals.critical + analytics.severityTotals.high,
      hint: "Highest-severity issues requiring priority action",
      icon: TriangleAlert,
    },
  ];

  return (
    <AdminShell
      title="Contributor Intelligence Overview"
      subtitle="Operational analytics for contributor profiles, quality outcomes, severity exposure, and repository-level coaching signals."
      // actions={
      //   <div className="flex flex-wrap gap-2">
      //     <Button
      //       variant="outline"
      //       onClick={() => router.push("/dashboard/admin/github")}
      //       className="gap-2"
      //     >
      //       <Github className="h-4 w-4" />
      //       GitHub Analysis
      //     </Button>
      //     <Button
      //       onClick={() => router.push("/dashboard/admin/profiles")}
      //       className="gap-2"
      //     >
      //       <Sparkles className="h-4 w-4" />
      //       Developer Profiles
      //     </Button>
      //   </div>
      // }
    >
      {error && (
        <Alert className="mb-6 border-destructive/40 bg-destructive/10">
          <CircleAlert className="h-4 w-4" />
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="overflow-hidden border-border/60 bg-background/80 shadow-sm"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-3 text-4xl font-bold">
                    {loading ? "--" : String(stat.value)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {stat.hint}
                  </p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <PieChartIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Profile analysis status</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Distribution of contributor profile execution states.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[290px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(value: number) => [`${value}`, "Profiles"]}
                  />
                  <Pie
                    data={analytics.statusChartData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={65}
                    outerRadius={108}
                    paddingAngle={3}
                  >
                    {analytics.statusChartData.map((entry) => (
                      <Cell key={entry.status} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {analytics.statusChartData.map((item) => (
                <div
                  key={item.status}
                  className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      {item.label}
                    </span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardHeader>
            <CardTitle>Finding severity exposure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[290px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.severityChartData}
                  margin={{ left: 0, right: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="severity" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={30} />
                  <Tooltip
                    formatter={(value: number) => [`${value}`, "Issues"]}
                  />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {analytics.severityChartData.map((item) => (
                      <Cell key={item.severity} fill={item.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  Critical + high ratio
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {analytics.severityTotals.total
                    ? `${Math.round(((analytics.severityTotals.critical + analytics.severityTotals.high) / analytics.severityTotals.total) * 100)}%`
                    : "0%"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Total issues</p>
                <p className="mt-1 text-2xl font-semibold">
                  {analytics.severityTotals.total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardHeader>
            <CardTitle>Top weakness categories</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topWeaknessData.length ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.topWeaknessData}
                    layout="vertical"
                    margin={{ left: 18, right: 10 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tickLine={false}
                      axisLine={false}
                      width={130}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value}`, "Mentions"]}
                    />
                    <Bar dataKey="count" fill="#2563eb" radius={10} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                Weakness categories will appear once profiles include weakness
                summaries.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardHeader>
            <CardTitle>Quality score distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.qualityDistributionData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="band" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={30} />
                  <Tooltip
                    formatter={(value: number) => [`${value}`, "Profiles"]}
                  />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 rounded-3xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Average profile quality
                </span>
                <span className="font-semibold">
                  {analytics.avgQuality
                    ? `${analytics.avgQuality.toFixed(2)}/10`
                    : "--"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardHeader>
            <CardTitle>Repository performance snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.repoRollup.length ? (
              analytics.repoRollup.map((repo) => (
                <div
                  key={repo.repoName}
                  className="rounded-2xl border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{repo.repoName}</p>
                    <Badge variant="outline">
                      {repo.profileCount} profiles
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>Completed: {repo.completed}</span>
                    <span>
                      Avg quality:{" "}
                      {repo.avgQuality !== null
                        ? `${repo.avgQuality.toFixed(1)}/10`
                        : "--"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                Repository performance data will appear when contributor
                profiles are generated.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardHeader>
            <CardTitle>Latest analyzed contributors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contributorProfiles
              .filter((profile) => !!profile.analyzedAt)
              .slice(0, 6)
              .map((profile) => (
                <div
                  key={`${profile.repositoryName}-${profile.contributorLogin}`}
                  className="rounded-2xl border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        @{profile.contributorLogin}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {profile.repositoryName}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <Flame className="h-3 w-3" />
                      {profile.qualityScore !== null
                        ? `${profile.qualityScore}/10`
                        : "--"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {profile.analyzedAt
                      ? shortDate(profile.analyzedAt)
                      : "No timestamp"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {profile.topWeaknesses?.[0]?.category
                      ? `Top weakness: ${profile.topWeaknesses[0].category}`
                      : "Recommendations will appear after analysis completes."}
                  </p>
                </div>
              ))}
            {!loading &&
              contributorProfiles.filter((profile) => !!profile.analyzedAt)
                .length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  Recently analyzed contributors will appear after the first
                  successful analysis runs.
                </div>
              )}
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}
