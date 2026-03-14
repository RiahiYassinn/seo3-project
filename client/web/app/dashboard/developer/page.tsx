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
import Link from "next/link";
import {
  Zap,
  TrendingUp,
  Users,
  GitBranch,
  Brain,
  Target,
  Star,
  Plus,
  CreditCard as Edit2,
  Github,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";

const proficiencyColors = {
  beginner: "bg-blue-100 text-blue-800",
  intermediate: "bg-yellow-100 text-yellow-800",
  advanced: "bg-purple-100 text-purple-800",
  expert: "bg-red-100 text-red-800",
};

const proficiencyIcons = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

// Mock data — replace with real API calls when backend is ready
const MOCK_SKILLS = [
  {
    id: "s1",
    skill_name: "React",
    proficiency_level: "expert",
    endorsements: 10,
  },
  {
    id: "s2",
    skill_name: "TypeScript",
    proficiency_level: "advanced",
    endorsements: 8,
  },
  {
    id: "s3",
    skill_name: "Node.js",
    proficiency_level: "intermediate",
    endorsements: 5,
  },
  {
    id: "s4",
    skill_name: "CSS",
    proficiency_level: "beginner",
    endorsements: 3,
  },
];

const MOCK_TEAM = {
  id: "team1",
  name: "Alpha Team",
  description: "We build awesome apps together",
};

export default function DeveloperDashboard() {
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

  if (!hasHydrated || !user)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const skills = MOCK_SKILLS;
  const team = MOCK_TEAM;

  const totalSkills = skills.length;
  const totalEndorsements = skills.reduce((sum, s) => sum + s.endorsements, 0);
  const expertSkills = skills.filter(
    (s) => s.proficiency_level === "expert",
  ).length;
  const proficiencyPct =
    totalSkills > 0 ? Math.round((expertSkills / totalSkills) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome back, {fullName}!</h1>
          <p className="text-muted-foreground">
            {team
              ? `You're part of ${team.name}`
              : "Complete your profile to get started"}
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-3xl font-bold">{totalSkills}</span>
              <Target className="w-8 h-8 text-primary opacity-50" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Endorsements
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-3xl font-bold">{totalEndorsements}</span>
              <Star className="w-8 h-8 text-secondary opacity-50" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expert Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-3xl font-bold">{expertSkills}</span>
              <Zap className="w-8 h-8 text-accent opacity-50" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Proficiency
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-3xl font-bold">{proficiencyPct}%</span>
              <TrendingUp className="w-8 h-8 text-primary opacity-50" />
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Skills list */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Skills</CardTitle>
                    <CardDescription>
                      Track and showcase your technical expertise
                    </CardDescription>
                  </div>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Skill
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {skills.length === 0 ? (
                  <div className="text-center py-12">
                    <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      No skills added yet
                    </p>
                    <Button variant="outline" size="sm">
                      Add your first skill
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium">{skill.skill_name}</h4>
                            <Badge
                              className={
                                proficiencyColors[
                                  skill.proficiency_level as keyof typeof proficiencyColors
                                ]
                              }
                            >
                              {skill.proficiency_level}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {Array.from({
                              length:
                                proficiencyIcons[
                                  skill.proficiency_level as keyof typeof proficiencyIcons
                                ],
                            }).map((_, i) => (
                              <Star
                                key={i}
                                className="w-4 h-4 fill-secondary text-secondary"
                              />
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {skill.endorsements}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            endorsements
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Profile */}
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground font-semibold">
                    Name
                  </p>
                  <p className="font-medium">{fullName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground font-semibold">
                    Email
                  </p>
                  <p className="font-medium text-sm">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground font-semibold">
                    Role
                  </p>
                  <Badge className="mt-1" variant="outline">
                    Developer
                  </Badge>
                </div>
                <Button className="w-full gap-2" variant="outline">
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </Button>
              </CardContent>
            </Card>

            {/* Team */}
            {team && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Your Team
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <h4 className="font-semibold mb-2">{team.name}</h4>
                  {team.description && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {team.description}
                    </p>
                  )}
                  <Button className="w-full" variant="outline" size="sm">
                    View Team
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm font-medium mb-1">
                    Master Advanced Skills
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You have strong fundamentals. Consider deepening your
                    expertise.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/5 border border-secondary/20">
                  <p className="text-sm font-medium mb-1">Share Knowledge</p>
                  <p className="text-xs text-muted-foreground">
                    Help teammates grow by mentoring on your expert areas.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* GitHub Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Github className="w-5 h-5" />
                  GitHub
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Link your GitHub account to auto-detect skills from your
                  repositories.
                </p>
                <Button className="w-full gap-2" variant="outline" asChild>
                  <Link href="/dashboard/developer/github">
                    <Github className="w-4 h-4" />
                    Manage Integration
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
