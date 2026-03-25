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
import { User as UserIcon, Users } from "lucide-react";
import { useAuthStore } from "@/lib/store";

const MOCK_TEAM = {
  id: "team1",
  name: "Alpha Team",
  description: "We build awesome apps together",
  members: [
    { id: "1", name: "Alice Johnson", role: "Senior Developer" },
    { id: "2", name: "Bob Smith", role: "Backend Developer" },
    { id: "3", name: "Carol Lee", role: "Frontend Developer" },
  ],
};

export default function DeveloperTeamPage() {
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

  const team = MOCK_TEAM;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold mb-1">Team</h1>
          <p className="text-muted-foreground">View and manage your team</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              {team.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    <UserIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{member.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {member.role}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    View Profile
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
