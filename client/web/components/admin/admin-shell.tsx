"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Github,
  LayoutDashboard,
  LogOut,
  Moon,
  Shield,
  Sun,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useTheme } from "@/hooks/use-theme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  {
    href: "/dashboard/admin/overview",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/admin/github",
    label: "GitHub Analysis",
    icon: Github,
  },
  {
    href: "/dashboard/admin/users",
    label: "Users",
    icon: Users,
  },
];

interface AdminShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function AdminShell({
  title,
  subtitle,
  children,
  actions,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasHydrated, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "admin") {
      router.replace("/login");
    }
  }, [hasHydrated, router, user]);

  const initials = useMemo(() => {
    if (!user) return "A";
    return (
      `${user.first_name?.charAt(0) ?? ""}${user.last_name?.charAt(0) ?? ""}`.toUpperCase() ||
      user.email?.charAt(0)?.toUpperCase() ||
      "A"
    );
  }, [user]);

  if (!hasHydrated || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,rgba(14,116,144,0.10),transparent_45%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.14),transparent_25%),linear-gradient(180deg,#f8fafc,#eef2ff)] dark:bg-[linear-gradient(135deg,rgba(6,182,212,0.14),transparent_42%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_20%),linear-gradient(180deg,#020617,#0f172a)]">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "border-r border-border/60 bg-background/90 backdrop-blur transition-all",
            collapsed ? "w-20" : "w-72",
          )}
        >
          <div className="flex h-full flex-col p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600 to-sky-500 text-white shadow-lg">
                  <Shield className="h-5 w-5" />
                </div>
                {!collapsed && (
                  <div>
                    <p className="text-sm font-semibold">Admin Workspace</p>
                    <p className="text-xs text-muted-foreground">
                      GitHub-driven developer insights
                    </p>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed((current) => !current)}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="mt-8 space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>

            <div className="mt-auto rounded-3xl border border-border/60 bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-gradient-to-br from-cyan-600 to-sky-500 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "mt-4 grid gap-2",
                  collapsed ? "grid-cols-1" : "grid-cols-2",
                )}
              >
                <Button
                  type="button"
                  variant="outline"
                  size={collapsed ? "icon" : "sm"}
                  onClick={toggleTheme}
                  className="justify-center"
                >
                  {isDark ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  {!collapsed && <span>{isDark ? "Light" : "Dark"}</span>}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size={collapsed ? "icon" : "sm"}
                  onClick={async () => {
                    await logout();
                    router.push("/");
                  }}
                  className="justify-center"
                >
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>Logout</span>}
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Admin dashboard
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
                  {subtitle}
                </p>
              </div>
              {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
