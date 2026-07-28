"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/store";
import { useTheme } from "@/hooks/use-theme";
import { useMounted } from "@/hooks/use-mounted";
import { NotificationButton } from "@/components/notifications/notification-button";

export function Navbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const { toggleTheme } = useTheme();
  const mounted = useMounted();
  const apiGatewayBaseUrl =
    process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:3006";

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  /** Initials fallback: first letter of first_name + first letter of last_name */
  const initials = user
    ? `${user.first_name?.charAt(0) ?? ""}${user.last_name?.charAt(0) ?? ""}`.toUpperCase() ||
      user.email?.charAt(0).toUpperCase()
    : "";

  const isAdminPage = pathname.startsWith("/dashboard/admin");
  const isActive = (href: string) => pathname === href;

  const roleSegment =
    user?.role === "admin"
      ? "admin"
      : user?.role === "tech_lead"
        ? "tech_lead"
        : "developer";
  const profileHref = `/dashboard/${roleSegment}/profile`;
  const workspaceHref =
    user?.role === "admin"
      ? "/dashboard/admin/overview"
      : `/dashboard/${roleSegment}/recommendations`;
  const avatarSrc = user?.avatar
    ? /^https?:\/\//i.test(user.avatar) || user.avatar.startsWith("blob:")
      ? user.avatar
      : user.avatar.startsWith("/")
        ? `${apiGatewayBaseUrl}${user.avatar}`
        : user.avatar
    : undefined;

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-10" priority />
          </Link>

          <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
            {isLanding && (
              <div className="hidden items-center gap-1 md:flex">
                {[
                  { href: "#features", label: "Features" },
                  { href: "#roles", label: "For your team" },
                  { href: "#how-it-works", label: "How it works" },
                  { href: "#faq", label: "FAQ" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
            {user?.role === "developer" && (
              <>
                <Link
                  href="/dashboard/developer/recommendations"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    pathname.startsWith(
                      "/dashboard/developer/recommendations",
                    ) || pathname.startsWith("/dashboard/developer/github")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  GitHub Recommendations
                </Link>
              </>
            )}
            {user?.role === "tech_lead" && (
              <>
                <Link
                  href="/dashboard/tech_lead/recommendations"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive("/dashboard/tech_lead/recommendations")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Mentor Queue
                </Link>
              </>
            )}
            {/* Admin Dashboard Navigation */}
            {user?.role === "admin" && isAdminPage && (
              <div className="flex items-center gap-1">
                <Link
                  href="/dashboard/admin/overview"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive("/dashboard/admin/overview")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Overview
                </Link>
                <Link
                  href="/dashboard/admin/github"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive("/dashboard/admin/github")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  GitHub
                </Link>
                <Link
                  href="/dashboard/admin/users"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive("/dashboard/admin/users")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Users
                </Link>
              </div>
            )}

            {/* Both icons render; CSS picks one so SSR and hydration agree. */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              <Moon className="h-4 w-4 dark:hidden" />
              <Sun className="hidden h-4 w-4 dark:block" />
            </button>

            {!mounted ? (
              // The persisted auth store only exists in the browser, so the
              // server cannot know whether to show the account menu. Hold a
              // neutral placeholder until after hydration.
              <div
                aria-hidden="true"
                className="h-9 w-24 animate-pulse rounded-md bg-muted"
              />
            ) : user ? (
              <>
                <NotificationButton />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Account menu"
                      className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 transition-colors hover:bg-muted"
                    >
                      <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                        <AvatarImage
                          src={avatarSrc}
                          alt={`${user.first_name} ${user.last_name}`}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-cyan-500 text-xs font-semibold text-white">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden text-sm font-medium sm:inline">
                        {user.first_name}
                      </span>
                      <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-sm font-medium">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={profileHref} className="cursor-pointer gap-2">
                        <UserRound className="h-4 w-4" />
                        My profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/dashboard/notifications"
                        className="cursor-pointer gap-2"
                      >
                        <Bell className="h-4 w-4" />
                        Notifications
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={workspaceHref}
                        className="cursor-pointer gap-2"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Workspace
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Get started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
