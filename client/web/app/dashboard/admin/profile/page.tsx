"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Github,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  ProfileWorkspace,
  type ProfileStat,
} from "@/components/profile/profile-workspace";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UserStats {
  total: number;
  admins: number;
  tech_leads: number;
  developers: number;
  active_today: number;
}

const adminShortcuts = [
  {
    href: "/dashboard/admin/users",
    label: "Users",
    description: "Create accounts, change roles, manage access",
    icon: Users,
  },
  {
    href: "/dashboard/admin/github",
    label: "GitHub analysis",
    description: "Run contributor analysis on repositories",
    icon: Github,
  },
  {
    href: "/dashboard/admin/profiles",
    label: "Developer profiles",
    description: "Review the generated skill profiles",
    icon: Sparkles,
  },
  {
    href: "/dashboard/admin/recommendations",
    label: "Recommendations",
    description: "Decide what happens next for each case",
    icon: Bot,
  },
];

export default function AdminProfilePage() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.get<UserStats>("/admin/stats");
      setStats(response.data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const profileStats: ProfileStat[] = [
    {
      label: "Total users",
      value: stats?.total ?? 0,
      icon: Users,
      hint: "Accounts on the platform",
    },
    {
      label: "Active today",
      value: stats?.active_today ?? 0,
      icon: UserRound,
      hint: "Signed in within 24h",
    },
    {
      label: "Tech leads",
      value: stats?.tech_leads ?? 0,
      icon: UserCog,
      hint: "Can mentor developers",
    },
    {
      label: "Developers",
      value: stats?.developers ?? 0,
      icon: Sparkles,
      hint: "Analyzed contributors",
    },
  ];

  return (
    <AdminShell
      title="My profile"
      subtitle="Your administrator identity, platform footprint, and the controls you use most."
    >
      <ProfileWorkspace
        stats={profileStats}
        statsLoading={statsLoading}
        aside={
          <Card className="border-primary/25 bg-primary/[0.05] shadow-sm">
            <CardContent className="flex gap-3 p-5">
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-semibold">Administrator account</p>
                <p className="mt-1 leading-6 text-muted-foreground">
                  You can change any user&apos;s role, email, and access from the
                  Users area — including your own.
                </p>
              </div>
            </CardContent>
          </Card>
        }
      >
        <Card className="border-border/60 bg-background/85 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Administration shortcuts</CardTitle>
            <p className="text-sm text-muted-foreground">
              The four places most admin work starts.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {adminShortcuts.map((shortcut) => (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="group flex items-start gap-3 rounded-xl border border-border/60 bg-muted/10 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <shortcut.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{shortcut.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {shortcut.description}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/85 shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-semibold">Need to edit someone else?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Roles, emails, and avatars for other accounts are managed in the
                Users area.
              </p>
            </div>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/dashboard/admin/users">
                Go to users
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </ProfileWorkspace>
    </AdminShell>
  );
}
