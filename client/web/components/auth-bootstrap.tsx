"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { authAPI } from "@/lib/auth";

export function AuthBootstrap() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setHasHydrated, setAuth, updateUser, logout, clearSession } =
    useAuthStore();

  const shouldSkipBootstrap =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email" ||
    pathname === "/auth/google/callback";

  useEffect(() => {
    if (shouldSkipBootstrap) {
      setHasHydrated(true);
      return;
    }

    const syncAuth = async () => {
      try {
        const currentUser = await authAPI.getCurrentUser();
        setAuth(currentUser);
      } catch {
        try {
          const refreshedSession = await authAPI.refreshToken();
          setAuth(refreshedSession.user);
        } catch {
          // No valid session: stay anonymous instead of bouncing to /login,
          // so public pages keep rendering for logged-out visitors.
          clearSession();
        }
      } finally {
        setHasHydrated(true);
      }
    };

    syncAuth();
  }, [clearSession, setAuth, setHasHydrated, shouldSkipBootstrap]);

  useEffect(() => {
    if (user?.is_first_login && pathname !== "/reset-password") {
      router.replace("/reset-password?first_login=1");
    }
  }, [pathname, router, user]);

  useEffect(() => {
    if (shouldSkipBootstrap || !user) {
      return;
    }

    const refreshInterval = window.setInterval(async () => {
      try {
        const refreshedSession = await authAPI.refreshToken();
        updateUser(refreshedSession.user);
      } catch (error) {
        console.error("Background refresh failed:", error);
        await logout();
      }
    }, 10 * 60 * 1000);

    return () => window.clearInterval(refreshInterval);
  }, [logout, shouldSkipBootstrap, updateUser, user]);

  return null;
}
