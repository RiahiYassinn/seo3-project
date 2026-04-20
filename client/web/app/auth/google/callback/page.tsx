"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";

function GoogleCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const completeGoogleLogin = async () => {
      const error = searchParams.get("error");
      if (error) {
        router.replace(`/login?error=${encodeURIComponent(error)}`);
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:3006"}/api/v1/auth/me`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error("Google authentication failed");
        }

        const currentUser = await response.json();
        setAuth(currentUser);
        router.replace("/dashboard");
      } catch {
        router.replace("/login?error=Google+authentication+failed");
      }
    };

    completeGoogleLogin();
  }, [searchParams, setAuth, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground text-sm">
          Completing sign-in with Google…
        </p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense>
      <GoogleCallbackHandler />
    </Suspense>
  );
}
