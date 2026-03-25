"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Code as Code2, Shield } from "lucide-react";
import { useAuthStore } from "@/lib/store";

export function Navbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const isLanding = pathname === "/";

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  /** Initials fallback: first letter of first_name + first letter of last_name */
  const initials = user
    ? `${user.first_name?.charAt(0) ?? ""}${user.last_name?.charAt(0) ?? ""}`.toUpperCase() ||
      user.email?.charAt(0).toUpperCase()
    : "";

  const isDeveloperPage = pathname.startsWith("/dashboard/developer");
  const isAdminPage = pathname.startsWith("/dashboard/admin");
  const isActive = (href: string) => pathname === href;

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/wevioo.png"
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

            {/* Developer Dashboard Navigation */}
            {user?.role === "developer" && isDeveloperPage && (
              <div className="flex items-center gap-1">
                <Link
                  href="/dashboard/developer/overview"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive("/dashboard/developer/overview")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Overview
                </Link>
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
                  href="/dashboard/developer/team"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive("/dashboard/developer/team")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Team
                </Link>
                <Link
                  href="/dashboard/developer/profile"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive("/dashboard/developer/profile")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Profile
                </Link>
              </div>
            )}

            {/* Admin Dashboard Navigation */}
            {user?.role === "admin" && isAdminPage && (
              <div className="flex items-center gap-1">
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
                <Link
                  href="/dashboard/admin/roles"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive("/dashboard/admin/roles")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Roles
                </Link>
                <Link
                  href="/dashboard/admin/analytics"
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive("/dashboard/admin/analytics")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Analytics
                </Link>
              </div>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">
                  <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                    <AvatarFallback className="bg-gradient-to-br from-primary via-secondary to-accent text-white font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link
                        href="/dashboard/admin/users"
                        className="cursor-pointer"
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Admin Panel</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {user.role === "developer" && (
                    <DropdownMenuItem asChild>
                      <Link
                        href="/dashboard/developer/overview"
                        className="cursor-pointer"
                      >
                        <Code2 className="mr-2 h-4 w-4" />
                        <span>My Skills</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
