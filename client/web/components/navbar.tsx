"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useTheme } from "@/hooks/use-theme";
import { NotificationButton } from "@/components/notifications/notification-button";

export function Navbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const { isDark, toggleTheme } = useTheme();
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
            <Image
              src="/logo.png"
              alt="Wevioo Logo"
              width={400}
              height={150}
              className="h-8 w-auto"
            />
          </Link>

          <div className="flex items-center gap-6">
            {isLanding && (
              <>
                <Link
                  href="#features"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Features
                </Link>
                <Link
                  href="#how-it-works"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  How It Works
                </Link>
              </>
            )}
            {user?.role === "developer" && (
              <>
                <Link
                  href="/dashboard/developer/github"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive("/dashboard/developer/github")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  GitHub
                </Link>
                <Link
                  href="/dashboard/developer/recommendations"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive("/dashboard/developer/recommendations")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Recommendations
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

            {user ? (
              <>
                <NotificationButton />
                <button
                  onClick={toggleTheme}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Toggle theme"
                >
                  {isDark ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </button>
                <Link
                  href={
                    user.role === "admin"
                      ? "/dashboard/admin/overview"
                      : user.role === "tech_lead"
                        ? "/dashboard/tech_lead/recommendations"
                        : "/dashboard/developer"
                  }
                  className="text-sm font-medium px-3 py-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  {user.first_name}
                </Link>
                <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                  <AvatarImage
                    src={avatarSrc}
                    alt={`${user.first_name} ${user.last_name}`}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary via-secondary to-accent text-white font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={handleLogout}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-destructive transition-colors"
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
