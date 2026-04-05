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
  Zap,
  TrendingUp,
  GitBranch,
  Brain,
  Target,
  Star,
  Plus,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";

const proficiencyColors = {
  beginner: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  intermediate:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  advanced:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  expert: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const proficiencyIcons = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

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

export default function DeveloperOverviewPage() {
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const skills = MOCK_SKILLS;

  const totalSkills = skills.length;
  const totalEndorsements = skills.reduce((sum, s) => sum + s.endorsements, 0);
  const expertSkills = skills.filter(
    (s) => s.proficiency_level === "expert",
  ).length;
  const proficiencyPct =
    totalSkills > 0 ? Math.round((expertSkills / totalSkills) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold mb-1">Overview</h1>
          <p className="text-muted-foreground">Welcome back, {fullName}</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
              <Star className="w-8 h-8 text-secondary opacity-50" />{" "}
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
              <Zap className="w-8 h-8 text-accent opacity-50" />{" "}
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

        {/* Skills Section */}
        <div className="grid lg:grid-cols-3 gap-6">
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
                        className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-lg">
                              {skill.skill_name}
                            </h4>
                            <Badge
                              variant="secondary"
                              className={
                                proficiencyColors[
                                  skill.proficiency_level as keyof typeof proficiencyColors
                                ]
                              }
                            >
                              {skill.proficiency_level}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
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
                          <p className="text-2xl font-bold">
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

          {/* Recommendations */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm font-medium mb-1">
                    Master Advanced Skills
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You have strong fundamentals. Consider deepening your
                    expertise.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/20">
                  {" "}
                  <p className="text-sm font-medium mb-1">Share Knowledge</p>
                  <p className="text-xs text-muted-foreground">
                    Help teammates grow by mentoring on your expert areas.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                  <p className="text-sm font-medium mb-1">Connect GitHub</p>
                  <p className="text-xs text-muted-foreground">
                    Link your GitHub account to auto-detect skills from your
                    projects.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
