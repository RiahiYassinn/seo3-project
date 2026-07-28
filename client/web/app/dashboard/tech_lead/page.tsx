"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { useAuthStore } from "@/lib/store";

export default function TechLeadDashboardRedirectPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "tech_lead") {
      router.replace("/dashboard");
      return;
    }

    router.replace("/dashboard/tech_lead/recommendations");
  }, [hasHydrated, router, user]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    </div>
  );
}
