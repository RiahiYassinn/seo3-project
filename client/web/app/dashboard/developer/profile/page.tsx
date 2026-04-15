"use client";
import { useEffect, useMemo, useState } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { Github } from "lucide-react";

interface GitHubIntegration {
  id: string;
  github_username: string;
  connected_at: string;
}

export default function DeveloperProfilePage() {
  const { user, hasHydrated } = useAuthStore();
  const router = useRouter();
  const [integration, setIntegration] = useState<GitHubIntegration | null>(null);

  useEffect(() => {
    if (!hasHydrated || !user || user.role !== "developer") return;

    const loadIntegration = async () => {
      try {
        const { data } = await api.get<GitHubIntegration>("/github/integration");
        setIntegration(data);
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          console.error("Failed to load GitHub integration:", error);
        }
      }
    };

    loadIntegration();
  }, [hasHydrated, user]);

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

  const avatarFallback = useMemo(() => {
    if (!user) return "D";
    return (
      `${user.first_name?.charAt(0) ?? ""}${user.last_name?.charAt(0) ?? ""}`.toUpperCase() ||
      user.username?.charAt(0)?.toUpperCase() ||
      "D"
    );
  }, [user]);

  const githubAvatarUrl = integration?.github_username
    ? `https://github.com/${integration.github_username}.png?size=240`
    : null;

  if (!hasHydrated || !user)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold mb-1">Profile</h1>
          <p className="text-muted-foreground">Manage your profile and preferences</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Manage your profile details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-2">
                    First Name
                  </label>
                  <Input value={user.first_name} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Last Name
                  </label>
                  <Input value={user.last_name} disabled />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  Email Address
                </label>
                <Input value={user.email} disabled />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  Username
                </label>
                <Input value={user.username} disabled />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  Role
                </label>
                <Badge variant="outline" className="capitalize">
                  {user.role}
                </Badge>
              </div>

              <div className="pt-4 border-t">
                <Button>Update Profile</Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Developer Identity</CardTitle>
                <CardDescription>
                  Your developer profile picture now follows the linked GitHub account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 border border-border/60">
                    <AvatarImage
                      src={githubAvatarUrl || undefined}
                      alt={`${user.username} GitHub avatar`}
                    />
                    <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                      {avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                    {integration ? (
                      <div className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Github className="h-4 w-4" />
                        Linked to @{integration.github_username}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No GitHub account linked yet.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  Change Password
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Notification Settings
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Privacy Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
