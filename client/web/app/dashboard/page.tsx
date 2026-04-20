"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";

export default function DashboardPage() {
  const { user, hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    const normalizedRole = String(user.role || "")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");

    if (normalizedRole === "admin") {
      router.replace("/dashboard/admin/overview");
      return;
    }

    if (normalizedRole === "developer") {
      router.replace("/dashboard/developer/overview");
      return;
    }

    if (normalizedRole === "tech_lead") {
      router.replace("/dashboard/tech_lead/recommendations");
      return;
    }

    router.replace("/login");
  }, [user, hasHydrated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}
