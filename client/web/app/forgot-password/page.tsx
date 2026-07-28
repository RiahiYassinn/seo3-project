"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/lib/auth";
import { BoxReveal, Input, Label, BottomGradient } from "@/components/ui/modern-animated-sign-in";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      setError("Email is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authAPI.forgotPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        {success ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3}>
              <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">
                Check your email
              </h2>
            </BoxReveal>
            <p className="text-muted-foreground text-sm">
              If an account with <span className="font-medium text-foreground">{email}</span> exists, you'll receive a password reset link shortly.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3}>
              <h2 className="font-bold text-3xl text-neutral-800 dark:text-neutral-200">
                Forgot password?
              </h2>
            </BoxReveal>
            <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3} className="pb-2">
              <p className="text-neutral-600 text-sm dark:text-neutral-300">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </BoxReveal>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3}>
                  <Label htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                </BoxReveal>
                <BoxReveal width="100%" boxColor="hsl(var(--skeleton))" duration={0.3}>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
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
                  {loading ? "Sending..." : "Send reset link"} &rarr;
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
        )}
      </div>
    </section>
  );
}
