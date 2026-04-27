"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";

export default function DeveloperProfileRedirectPage() {
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
      return;
    }

    router.replace("/dashboard/developer");
  }, [hasHydrated, router, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}
