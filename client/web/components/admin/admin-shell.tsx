"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Github,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sparkles,
  Shield,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useTheme } from "@/hooks/use-theme";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "admin-sidebar-collapsed";

const navigation = [
  {
    href: "/dashboard/admin/overview",
    label: "Overview",
    description: "Executive summary",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/admin/github",
    label: "GitHub Analysis",
    description: "Repos and contributor runs",
    icon: Github,
  },
  {
    href: "/dashboard/admin/profiles",
    label: "Developer Profiles",
    description: "Generated coaching profiles",
    icon: Sparkles,
  },
  {
    href: "/dashboard/admin/recommendations",
    label: "Recommendations",
    description: "AI action plans",
    icon: Shield,
  },
  {
    href: "/dashboard/admin/users",
    label: "Users",
    description: "Access and administration",
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return (
      window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true"
    );
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const apiGatewayBaseUrl =
    process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:3006";

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

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      collapsed.toString(),
    );
  }, [collapsed]);

  const initials = useMemo(() => {
    if (!user) return "A";
    return (
      `${user.first_name?.charAt(0) ?? ""}${user.last_name?.charAt(0) ?? ""}`.toUpperCase() ||
      user.email?.charAt(0)?.toUpperCase() ||
      "A"
    );
  }, [user]);

  const avatarSrc = useMemo(() => {
    const rawAvatar = user?.avatar;
    if (!rawAvatar) return undefined;
    if (/^https?:\/\//i.test(rawAvatar) || rawAvatar.startsWith("blob:")) {
      return rawAvatar;
    }
    if (rawAvatar.startsWith("/")) {
      return `${apiGatewayBaseUrl}${rawAvatar}`;
    }
    return rawAvatar;
  }, [apiGatewayBaseUrl, user?.avatar]);

  if (!hasHydrated || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_22%),linear-gradient(180deg,#f8fafc,#eef2f7)] dark:bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.18),transparent_26%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_22%),linear-gradient(180deg,#020617,#0f172a)]">
      <div className="flex min-h-screen">
        <div
          className={cn(
            "fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm transition-opacity lg:hidden",
            mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileSidebarOpen(false)}
        />

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out lg:sticky lg:top-0 lg:translate-x-0",
            isDark
              ? "border-white/6 bg-slate-950/92 text-slate-100"
              : "border-slate-200/80 bg-white/90 text-slate-900",
            collapsed ? "w-24" : "w-80",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-full flex-col px-4 py-5">
            <div className="flex items-center justify-between gap-3">
              <div
                className={cn(
                  "flex min-w-0 items-center gap-3",
                  collapsed && "justify-center",
                )}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br">
                  <Link href="/" className="flex items-center gap-3">
                    <Image
                      src="/logo.png"
                      alt="Wevioo Logo"
                      width={400}
                      height={150}
                      className="h-8 w-auto"
                    />
                  </Link>
                </div>
                {!collapsed && (
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-sm font-semibold tracking-wide",
                        isDark ? "text-white" : "text-slate-900",
                      )}
                    >
                      Wevioo Consulting
                    </p>
                    <p
                      className={cn(
                        "truncate text-xs",
                        isDark ? "text-slate-400" : "text-slate-600",
                      )}
                    >
                      Developer intelligence platform
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileSidebarOpen(false)}
                  className={cn(
                    "lg:hidden",
                    isDark
                      ? "text-slate-300 hover:bg-white/10 hover:text-white"
                      : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900",
                  )}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed((current) => !current)}
                  className={cn(
                    "hidden lg:flex",
                    isDark
                      ? "text-slate-300 hover:bg-white/10 hover:text-white"
                      : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900",
                  )}
                >
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-8 flex-1">
              <nav className="space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex rounded-2xl transition-all duration-200",
                        collapsed
                          ? "mx-auto h-14 w-14 items-center justify-center"
                          : "items-center gap-3 px-4 py-3.5",
                        active
                          ? isDark
                            ? "bg-white text-slate-950 shadow-lg shadow-slate-950/20"
                            : "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                          : isDark
                            ? "text-slate-300 hover:bg-white/8 hover:text-white"
                            : "text-slate-700 hover:bg-slate-900/5 hover:text-slate-900",
                      )}
                    >
                      <div
                        className={cn(
                          "flex shrink-0 items-center justify-center rounded-xl",
                          collapsed ? "h-10 w-10" : "h-10 w-10",
                          active
                            ? isDark
                              ? "bg-slate-950/8 text-slate-950"
                              : "bg-white/15 text-white"
                            : isDark
                              ? "bg-white/5 text-slate-300 group-hover:bg-white/10 group-hover:text-white"
                              : "bg-slate-900/5 text-slate-600 group-hover:bg-slate-900/10 group-hover:text-slate-900",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      {!collapsed && (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {item.label}
                          </p>
                          <p
                            className={cn(
                              "truncate text-xs",
                              active
                                ? isDark
                                  ? "text-slate-600"
                                  : "text-slate-200"
                                : "text-slate-500",
                            )}
                          >
                            {item.description}
                          </p>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div
              className={cn(
                "mt-6 rounded-3xl border p-4",
                isDark
                  ? "border-white/6 bg-white/[0.045]"
                  : "border-slate-900/10 bg-slate-900/[0.03]",
                collapsed && "px-2",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-3",
                  collapsed && "justify-center",
                )}
              >
                <Avatar
                  className={cn(
                    "h-11 w-11 border",
                    isDark ? "border-white/10" : "border-slate-900/10",
                  )}
                >
                  <AvatarImage
                    src={avatarSrc}
                    alt={`${user.first_name} ${user.last_name}`}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-sm font-semibold",
                        isDark ? "text-white" : "text-slate-900",
                      )}
                    >
                      {user.first_name} {user.last_name}
                    </p>
                    <p
                      className={cn(
                        "truncate text-xs",
                        isDark ? "text-slate-400" : "text-slate-600",
                      )}
                    >
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
                  className={cn(
                    isDark
                      ? "border-white/12 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                    collapsed ? "mx-auto h-11 w-11" : "justify-center",
                  )}
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
                  className={cn(
                    isDark
                      ? "border-white/12 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                    collapsed ? "mx-auto h-11 w-11" : "justify-center",
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>Logout</span>}
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
            <div className="rounded-[2rem] bg-white/72 shadow-[0_30px_80px_rgba(15,23,42,0.08)] ring-1 ring-slate-950/5 backdrop-blur-xl dark:bg-slate-950/45 dark:ring-white/6">
              <div className="border-b border-slate-950/6 px-5 py-4 dark:border-white/6 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setMobileSidebarOpen(true)}
                      className="mt-1 lg:hidden"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                    <div>
                      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                        {title}
                      </h1>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                        {subtitle}
                      </p>
                    </div>
                  </div>
                  {actions ? (
                    <div className="flex w-full flex-wrap gap-3 lg:w-auto lg:justify-end">
                      {actions}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="px-5 py-6 sm:px-6 lg:px-8 lg:py-8">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
