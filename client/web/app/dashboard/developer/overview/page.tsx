"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/store";
import {
  ArrowUpRight,
  Award,
  Brain,
  CheckCircle2,
  Code2,
  Flame,
  GitBranch,
  LayoutDashboard,
  Sparkles,
  Star,
  Target,
  TimerReset,
  TrendingUp,
  Trophy,
  Users2,
} from "lucide-react";

const velocityData = [
  { month: "Jan", commits: 42, reviews: 10 },
  { month: "Feb", commits: 51, reviews: 14 },
  { month: "Mar", commits: 49, reviews: 18 },
  { month: "Apr", commits: 64, reviews: 20 },
  { month: "May", commits: 72, reviews: 22 },
  { month: "Jun", commits: 78, reviews: 26 },
];

const skillDistributionData = [
  { skill: "Frontend", score: 92 },
  { skill: "Backend", score: 84 },
  { skill: "Testing", score: 76 },
  { skill: "DevOps", score: 68 },
  { skill: "System Design", score: 88 },
  { skill: "Mentoring", score: 90 },
];

const impactData = [
  { area: "React", value: 95 },
  { area: "TypeScript", value: 89 },
  { area: "Node.js", value: 82 },
  { area: "APIs", value: 86 },
  { area: "CI/CD", value: 71 },
];

const topSkills = [
  { name: "React Architecture", level: 96, trend: "+12%" },
  { name: "TypeScript", level: 91, trend: "+9%" },
  { name: "Design Systems", level: 88, trend: "+15%" },
  { name: "Node Services", level: 80, trend: "+6%" },
  { name: "Testing", level: 77, trend: "+11%" },
];

const activityFeed = [
  {
    title: "Merged dashboard analytics refactor",
    meta: "4 hours ago",
    icon: GitBranch,
  },
  {
    title: "Mentored two teammates on API contracts",
    meta: "Yesterday",
    icon: Users2,
  },
  {
    title: "Improved TypeScript coverage by 8%",
    meta: "2 days ago",
    icon: CheckCircle2,
  },
  {
    title: "Opened reusable chart component library",
    meta: "This week",
    icon: LayoutDashboard,
  },
];

const recommendations = [
  "Lean into DevOps automation to round out an already strong product engineering profile.",
  "Package your dashboard patterns into a shared internal UI kit for faster team delivery.",
  "Keep pairing on architecture reviews. Your mentoring score suggests strong leadership leverage.",
];

const stats = [
  {
    title: "Skill Coverage",
    value: "18",
    subtitle: "core technologies mapped",
    trend: "+4 this quarter",
    icon: Target,
  },
  {
    title: "Avg. Proficiency",
    value: "87%",
    subtitle: "across active stacks",
    trend: "+9% momentum",
    icon: TrendingUp,
  },
  {
    title: "Peer Endorsements",
    value: "126",
    subtitle: "from leads and teammates",
    trend: "Top 8% in team",
    icon: Trophy,
  },
  {
    title: "Delivery Streak",
    value: "14w",
    subtitle: "consistent output cadence",
    trend: "Zero missed sprints",
    icon: Flame,
  },
];

function DeveloperOverviewDashboard() {
  const { user, hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "developer") {
      router.replace("/dashboard");
    }
  }, [user, hasHydrated, router]);

  if (!hasHydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const fullName = `${user.first_name} ${user.last_name}`.trim() || user.email;
  const velocityChart = (
    <AreaChart width={860} height={320} data={velocityData} margin={{ left: 0, right: 12 }}>
      <defs>
        <linearGradient id="fillCommits" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
          <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
        </linearGradient>
        <linearGradient id="fillReviews" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="month" tickLine={false} axisLine={false} />
      <YAxis tickLine={false} axisLine={false} width={36} />
      <Tooltip />
      <Legend />
      <Area
        type="monotone"
        dataKey="commits"
        stroke="hsl(var(--chart-1))"
        fill="url(#fillCommits)"
        strokeWidth={3}
      />
      <Area
        type="monotone"
        dataKey="reviews"
        stroke="hsl(var(--chart-2))"
        fill="url(#fillReviews)"
        strokeWidth={3}
      />
    </AreaChart>
  );

  const strengthChart = (
    <RadarChart width={420} height={320} data={skillDistributionData}>
      <Tooltip />
      <PolarGrid />
      <PolarAngleAxis dataKey="skill" />
      <Radar
        dataKey="score"
        stroke="hsl(var(--chart-3))"
        fill="hsl(var(--chart-3))"
        fillOpacity={0.3}
      />
    </RadarChart>
  );

  const impactChart = (
    <BarChart
      width={520}
      height={300}
      data={impactData}
      layout="vertical"
      margin={{ left: 18, right: 8 }}
    >
      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
      <XAxis type="number" hide />
      <YAxis
        dataKey="area"
        type="category"
        tickLine={false}
        axisLine={false}
        width={82}
      />
      <Tooltip />
      <Bar dataKey="value" radius={10} fill="hsl(var(--chart-1))" />
    </BarChart>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="relative overflow-hidden border-b border-border bg-[radial-gradient(circle_at_top_left,_rgba(142,191,45,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(255,112,34,0.16),_transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(142,191,45,0.22),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(255,112,34,0.18),_transparent_20%),linear-gradient(180deg,rgba(2,8,23,0.98),rgba(15,23,42,0.96))]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-3xl">
            <Badge className="mb-4 rounded-full bg-primary/10 px-4 py-1 text-primary hover:bg-primary/10">
              Developer Intelligence Dashboard
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Showcase your technical depth with a sharper, more professional story.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {fullName}&apos;s profile highlights delivery consistency, team
              influence, stack strength, and growth opportunities in one clean
              dashboard.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button className="gap-2 rounded-full px-5">
                <Sparkles className="h-4 w-4" />
                Export Portfolio
              </Button>
              <Button variant="outline" className="gap-2 rounded-full px-5">
                <ArrowUpRight className="h-4 w-4" />
                Share with Tech Leads
              </Button>
            </div>
          </div>

          <Card className="w-full max-w-sm border-white/40 bg-white/80 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/5">
            <CardHeader className="pb-4">
              <CardDescription>Developer Signal</CardDescription>
              <CardTitle className="flex items-end gap-3 text-5xl">
                91
                <span className="pb-1 text-sm font-medium text-emerald-500">
                  +7.4%
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground">Execution</p>
                  <p className="mt-1 text-xl font-semibold">94</p>
                </div>
                <div className="rounded-2xl bg-secondary/10 p-3">
                  <p className="text-xs text-muted-foreground">Quality</p>
                  <p className="mt-1 text-xl font-semibold">89</p>
                </div>
                <div className="rounded-2xl bg-accent/10 p-3">
                  <p className="text-xs text-muted-foreground">Leadership</p>
                  <p className="mt-1 text-xl font-semibold">90</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Promotion Readiness</span>
                  <span className="font-semibold">83%</span>
                </div>
                <Progress value={83} className="mt-3 h-2.5" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.title}
                className="border-border/60 bg-card/80 shadow-sm transition-transform duration-200 hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="mt-3 text-3xl font-bold">{stat.value}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {stat.subtitle}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight className="h-4 w-4" />
                    <span>{stat.trend}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <Card className="overflow-hidden border-border/60">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardDescription>Performance Analytics</CardDescription>
                <CardTitle className="text-2xl">
                  Delivery velocity and review contribution
                </CardTitle>
              </div>
              <Tabs defaultValue="6m">
                <TabsList className="grid w-full grid-cols-3 sm:w-[220px]">
                  <TabsTrigger value="30d">30D</TabsTrigger>
                  <TabsTrigger value="6m">6M</TabsTrigger>
                  <TabsTrigger value="1y">1Y</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto text-xs">
                <div className="min-w-[760px]">{velocityChart}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardDescription>Strength Map</CardDescription>
              <CardTitle className="text-2xl">Skill balance across core domains</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="mx-auto flex justify-center overflow-x-auto text-xs">
                {strengthChart}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardDescription>Showcase Skills</CardDescription>
                <CardTitle className="text-2xl">Top competencies and momentum</CardTitle>
              </div>
              <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                Updated from recent activity
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              {topSkills.map((skill) => (
                <div key={skill.name} className="rounded-2xl border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{skill.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Demonstrated through commits, reviews, and shipped features
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{skill.level}%</p>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">
                        {skill.trend}
                      </p>
                    </div>
                  </div>
                  <Progress value={skill.level} className="mt-4 h-2.5" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardDescription>Career Signal</CardDescription>
              <CardTitle className="text-2xl">What makes this developer stand out</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl bg-primary/10 p-4">
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-primary" />
                  <p className="font-semibold">Consistently strong frontend leadership</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Strong architecture choices, design system thinking, and high
                  product polish make this profile highly presentation-ready.
                </p>
              </div>
              <div className="rounded-2xl bg-secondary/10 p-4">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-secondary" />
                  <p className="font-semibold">High learning velocity</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  New skills are compounding quickly, especially around testing,
                  service design, and cross-team collaboration.
                </p>
              </div>
              <div className="rounded-2xl bg-accent/10 p-4">
                <div className="flex items-center gap-3">
                  <TimerReset className="h-5 w-5 text-accent" />
                  <p className="font-semibold">Best next focus area</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Deepen deployment automation and observability to complete the
                  jump from strong builder to end-to-end platform owner.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.95fr_0.85fr]">
          <Card className="border-border/60">
            <CardHeader>
              <CardDescription>Skill Impact</CardDescription>
              <CardTitle className="text-2xl">Contribution by technical area</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto text-xs">
                <div className="min-w-[420px]">{impactChart}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardDescription>Recent Wins</CardDescription>
              <CardTitle className="text-2xl">Signals from current work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activityFeed.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex gap-3 rounded-2xl border border-border/60 p-4"
                  >
                    <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.meta}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardDescription>Growth Recommendations</CardDescription>
              <CardTitle className="text-2xl">Smart next moves</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recommendations.map((recommendation, index) => (
                <div
                  key={recommendation}
                  className="rounded-2xl border border-border/60 bg-muted/40 p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Star className="h-4 w-4 text-secondary" />
                    <p className="text-sm font-semibold">Priority {index + 1}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{recommendation}</p>
                </div>
              ))}
              <Button variant="outline" className="w-full gap-2 rounded-full">
                <Code2 className="h-4 w-4" />
                Build Learning Path
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

export default DeveloperOverviewDashboard;
