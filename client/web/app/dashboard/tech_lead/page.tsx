"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  TrendingUp,
  Target,
  Brain,
  Zap,
  ChartBar as BarChart3,
  Plus,
  ArrowUpRight,
  CircleAlert as AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";

// Mock data — replace with real API calls when backend is ready
const MOCK_TEAM = {
  id: "team1",
  name: "Alpha Team",
  description: "We build awesome apps together",
  members: [
    {
      id: "m1",
      full_name: "Alice Smith",
      email: "alice@example.com",
      role: "developer",
      bio: "Frontend dev",
    },
    {
      id: "m2",
      full_name: "Bob Johnson",
      email: "bob@example.com",
      role: "developer",
      bio: "Backend dev",
    },
    {
      id: "m3",
      full_name: "Carol Lee",
      email: "carol@example.com",
      role: "developer",
      bio: "Fullstack dev",
    },
  ],
};

const MOCK_STATS = {
  averageSkills: 5,
  skillGaps: 1,
  mentorshipOpportunities: 1,
};

export default function TechLeadDashboard() {
  const { user, hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "tech_lead") {
      router.replace("/dashboard");
    }
  }, [user, hasHydrated, router]);

  if (!hasHydrated || !user)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const team = MOCK_TEAM;
  const stats = {
    totalMembers: team.members.length,
    ...MOCK_STATS,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome, {fullName}!</h1>
          <p className="text-muted-foreground">
            Manage your team's skills and growth
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Team Members
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.totalMembers}</span>
              <Users className="w-8 h-8 text-primary opacity-50" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Skills/Person
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.averageSkills}</span>
              <Brain className="w-8 h-8 text-secondary opacity-50" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Skill Gaps
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.skillGaps}</span>
              <AlertCircle className="w-8 h-8 text-accent opacity-50" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mentorship Ops
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-3xl font-bold">
                {stats.mentorshipOpportunities}
              </span>
              <Zap className="w-8 h-8 text-primary opacity-50" />
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{team.name}</CardTitle>
                    <CardDescription>{team.description}</CardDescription>
                  </div>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" /> Invite Member
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" /> Team Members (
                  {team.members.length})
                </CardTitle>
                <CardDescription>
                  Manage and monitor your team's development
                </CardDescription>
              </CardHeader>
              <CardContent>
                {team.members.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      No team members yet
                    </p>
                    <Button variant="outline" size="sm">
                      Invite your first team member
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {team.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <h4 className="font-medium">{member.full_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {member.email}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {member.bio}
                          </p>
                        </div>
                        <Badge variant="outline">{member.role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Team Insights */}
            <Card>
              <CardHeader>
                <CardTitle>Team Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Team Coverage</span>
                    <span className="text-sm font-bold text-primary">75%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2"
                      style={{ width: "75%" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      Skill Distribution
                    </span>
                    <span className="text-sm font-bold text-secondary">
                      8/10
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-secondary rounded-full h-2"
                      style={{ width: "80%" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      Development Velocity
                    </span>
                    <span className="text-sm font-bold text-accent">6/10</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-accent rounded-full h-2"
                      style={{ width: "60%" }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex gap-2 items-start">
                  <ArrowUpRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Mentorship Program</p>
                    <p className="text-xs text-muted-foreground">
                      Set up peer mentoring between experienced and junior
                      developers.
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/5 border border-secondary/20 flex gap-2 items-start">
                  <Target className="w-4 h-4 mt-0.5 text-secondary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Skill Gap Analysis</p>
                    <p className="text-xs text-muted-foreground">
                      Identify critical skills needed for team growth.
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 flex gap-2 items-start">
                  <BarChart3 className="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Performance Tracking</p>
                    <p className="text-xs text-muted-foreground">
                      Monitor team progress and celebrate wins.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
