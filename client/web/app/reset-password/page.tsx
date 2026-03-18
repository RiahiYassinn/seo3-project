"use client";
import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authAPI } from "@/lib/auth";
import { BoxReveal, Input, Label, BottomGradient } from "@/components/ui/modern-animated-sign-in";
import { Eye, EyeOff } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid or missing reset token. Please request a new reset link.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">Invalid reset link</h2>
        <p className="text-muted-foreground text-sm">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <button
          onClick={() => router.push("/forgot-password")}
          className="w-full py-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Request new link
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3}>
          <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">
            Password reset!
          </h2>
        </BoxReveal>
        <p className="text-muted-foreground text-sm">
          Your password has been reset successfully. Redirecting to login…
        </p>
        <button
          onClick={() => router.push("/login")}
          className="w-full py-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3}>
        <h2 className="font-bold text-3xl text-neutral-800 dark:text-neutral-200">
          Reset password
        </h2>
      </BoxReveal>
      <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3} className="pb-2">
        <p className="text-neutral-600 text-sm dark:text-neutral-300">
          Enter your new password below.
        </p>
      </BoxReveal>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3}>
            <Label htmlFor="password">
              New Password <span className="text-red-500">*</span>
            </Label>
          </BoxReveal>
          <BoxReveal width="100%" boxColor="hsl(var(--skeleton))" duration={0.3}>
            <div className="relative">
              <Input
                id="password"
                type={visible ? "text" : "password"}
                placeholder="Enter new password (min 8 characters)"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {visible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
            </div>
          </BoxReveal>
        </div>

        <div className="flex flex-col gap-2">
          <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3}>
            <Label htmlFor="confirm-password">
              Confirm Password <span className="text-red-500">*</span>
            </Label>
          </BoxReveal>
          <BoxReveal width="100%" boxColor="hsl(var(--skeleton))" duration={0.3}>
            <Input
              id="confirm-password"
              type={visible ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError("");
              }}
              required
            />
          </BoxReveal>
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        <BoxReveal width="100%" boxColor="hsl(var(--skeleton))" duration={0.3} overflow="visible">
          <button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-br relative group/btn from-zinc-200 dark:from-zinc-900 dark:to-zinc-900 to-zinc-200 block dark:bg-zinc-800 w-full text-black dark:text-white rounded-md h-10 font-medium shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:shadow-[0px_1px_0px_0px_var(--zinc-800)_inset,0px_-1px_0px_0px_var(--zinc-800)_inset] outline-hidden hover:cursor-pointer disabled:opacity-60"
          >
            {loading ? "Resetting..." : "Reset password"} &rarr;
            <BottomGradient />
          </button>
        </BoxReveal>
      </form>

      <div className="text-center">
        <button
          onClick={() => router.push("/login")}
          className="text-sm text-blue-500 hover:cursor-pointer outline-hidden"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <section className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </section>
  );
}
