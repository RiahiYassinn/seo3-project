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
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/store";

export default function DeveloperProfilePage() {
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
