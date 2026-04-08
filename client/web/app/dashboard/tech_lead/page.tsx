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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  Mail,
  Settings as SettingsIcon,
  Award,
  Activity,
  UserCircle,
  LayoutDashboard,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";

// Mock data — replace with real API calls when backend is ready
const MOCK_TEAM = {
  id: "team1",
  name: "Alpha Team",
  description: "Building next-generation applications",
  members: [
    {
      id: "m1",
      full_name: "Alice Smith",
      email: "alice@example.com",
      role: "developer",
      bio: "Frontend Specialist",
      skills: 8,
      endorsements: 12,
    },
    {
      id: "m2",
      full_name: "Bob Johnson",
      email: "bob@example.com",
      role: "developer",
      bio: "Backend Developer",
      skills: 6,
      endorsements: 9,
    },
    {
      id: "m3",
      full_name: "Carol Lee",
      email: "carol@example.com",
      role: "developer",
      bio: "Full-stack Engineer",
      skills: 10,
      endorsements: 15,
    },
    {
      id: "m4",
      full_name: "David Chen",
      email: "david@example.com",
      role: "developer",
      bio: "DevOps Engineer",
      skills: 7,
      endorsements: 11,
    },
  ],
};

const MOCK_STATS = {
  averageSkills: 7.75,
  skillGaps: 3,
  mentorshipOpportunities: 5,
  teamVelocity: 85,
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
      <div className="min-h-screen flex items-center justify-center bg-background">
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
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold mb-1">Tech Lead Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome, {fullName} — Manage your team's growth and development
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 h-auto">
            <TabsTrigger value="overview" className="gap-2 py-3">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2 py-3">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 py-3">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 py-3">
              <SettingsIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Team Members
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-3xl font-bold">
                    {stats.totalMembers}
                  </span>
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
                  <span className="text-3xl font-bold">
                    {stats.averageSkills}
                  </span>
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
                    Team Velocity
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-3xl font-bold">
                    {stats.teamVelocity}%
                  </span>
                  <Zap className="w-8 h-8 text-primary opacity-50" />
                </CardContent>
              </Card>
            </div>

            {/* Team Overview */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {team.name}
                    </CardTitle>
                    <CardDescription>{team.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {team.members.slice(0, 3).map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20">
                            <span className="text-lg font-bold">
                              {member.full_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">
                              {member.full_name}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {member.bio}
                            </p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {member.skills} skills
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {member.endorsements} endorsements
                              </span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button className="w-full mt-4" variant="outline">
                      View All Members
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button className="w-full justify-start gap-2">
                      <Plus className="w-4 h-4" />
                      Invite Team Member
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                    >
                      <Award className="w-4 h-4" />
                      Give Endorsement
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Send Team Update
                    </Button>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="w-5 h-5" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex gap-2 items-start">
                      <ArrowUpRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          Mentorship Program
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Set up peer mentoring for skill development
                        </p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/5 border border-secondary/20 flex gap-2 items-start">
                      <Target className="w-4 h-4 mt-0.5 text-secondary flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          Skill Gap Analysis
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Review critical skills needed for growth
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Team Members ({team.members.length})
                    </CardTitle>
                    <CardDescription>
                      Manage and monitor your team's development
                    </CardDescription>
                  </div>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Invite Member
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20">
                        <span className="text-xl font-bold">
                          {member.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">
                          {member.full_name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {member.email}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {member.bio}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {member.skills} skills
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {member.endorsements} endorsements
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm">
                          View Profile
                        </Button>
                        <Button variant="outline" size="sm">
                          Give Endorsement
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Team Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Team Insights
                  </CardTitle>
                  <CardDescription>
                    Performance metrics and trends
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Team Coverage</span>
                      <span className="text-sm font-bold text-primary">
                        75%
                      </span>
                    </div>
                    <Progress value={75} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Percentage of required skills covered by the team
                    </p>
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
                    <Progress value={80} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Balance of skills across team members
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        Development Velocity
                      </span>
                      <span className="text-sm font-bold text-accent">
                        {stats.teamVelocity}%
                      </span>
                    </div>
                    <Progress value={stats.teamVelocity} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Team productivity and delivery speed
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        Engagement Score
                      </span>
                      <span className="text-sm font-bold text-primary">
                        92%
                      </span>
                    </div>
                    <Progress value={92} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Overall team engagement and participation
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Skill Gaps */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Skill Gaps & Opportunities
                  </CardTitle>
                  <CardDescription>
                    Areas needing attention or development
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg border border-orange-500/20 bg-orange-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-sm">Cloud Architecture</h5>
                      <Badge variant="outline" className="text-xs">Critical</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Only 1 team member has advanced cloud skills
                    </p>
                    <Button size="sm" variant="outline" className="w-full">
                      Plan Training
                    </Button>
                  </div>

                  <div className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-sm">DevOps Practices</h5>
                      <Badge variant="outline" className="text-xs">Medium</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Team could benefit from CI/CD expertise
                    </p>
                    <Button size="sm" variant="outline" className="w-full">
                      Assign Mentor
                    </Button>
                  </div>

                  <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-sm">Security Best Practices</h5>
                      <Badge variant="outline" className="text-xs">Low</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Optional but valuable for team growth
                    </p>
                    <Button size="sm" variant="outline" className="w-full">
                      Schedule Workshop
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Growth Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Growth Trends
                  </CardTitle>
                  <CardDescription>
                    Team development over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5">
                      <div>
                        <p className="text-sm font-medium">Skills Added</p>
                        <p className="text-xs text-muted-foreground">Last 30 days</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">12</p>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" /> +25%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/5">
                      <div>
                        <p className="text-sm font-medium">Endorsements Given</p>
                        <p className="text-xs text-muted-foreground">Last 30 days</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-secondary">47</p>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" /> +18%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5">
                      <div>
                        <p className="text-sm font-medium">Team Activity</p>
                        <p className="text-xs text-muted-foreground">Last 7 days</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-accent">94%</p>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" /> +5%
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Performers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Top Performers
                  </CardTitle>
                  <CardDescription>
                    Team members leading in skill development
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {team.members
                      .sort((a, b) => b.endorsements - a.endorsements)
                      .slice(0, 3)
                      .map((member, idx) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border"
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 font-bold">
                            #{idx + 1}
                          </div>
                          <div className="flex-1">
                            <h5 className="font-semibold text-sm">
                              {member.full_name}
                            </h5>
                            <p className="text-xs text-muted-foreground">
                              {member.endorsements} endorsements • {member.skills} skills
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Team Settings</CardTitle>
                  <CardDescription>
                    Configure your team preferences and policies
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Team Name
                    </label>
                    <p className="text-sm text-muted-foreground mb-2">
                      The name that identifies your team
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        defaultValue={team.name}
                        className="flex-1 px-3 py-2 border rounded-md"
                        disabled
                      />
                      <Button variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Team Description
                    </label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Brief description of your team's purpose
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        defaultValue={team.description}
                        className="flex-1 px-3 py-2 border rounded-md"
                        disabled
                      />
                      <Button variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-4">Preferences</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Auto-endorsements</p>
                          <p className="text-xs text-muted-foreground">
                            Automatically suggest endorsements based on activity
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          Enable
                        </Button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Skill Notifications</p>
                          <p className="text-xs text-muted-foreground">
                            Notify when team members add new skills
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          Enable
                        </Button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Weekly Reports</p>
                          <p className="text-xs text-muted-foreground">
                            Receive weekly team performance summaries
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          Enable
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button>Save Changes</Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Name
                      </p>
                      <p className="font-medium">{fullName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Email
                      </p>
                      <p className="text-sm">{user.email}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Role
                      </p>
                      <Badge variant="outline" className="capitalize">
                        Tech Lead
                      </Badge>
                    </div>
                    <div className="pt-2 border-t">
                      <Button variant="outline" className="w-full gap-2">
                        <UserCircle className="w-4 h-4" />
                        Edit Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Danger Zone</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-destructive hover:text-destructive"
                    >
                      Archive Team
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-destructive hover:text-destructive"
                    >
                      Delete Team
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
