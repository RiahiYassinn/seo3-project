"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  FolderGit2,
  Github,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  type AdminWorkflowContext,
  buildAdminWorkflowHref,
} from "@/lib/admin-workflow";
import { cn } from "@/lib/utils";

export type AdminWorkflowStepId = "analysis" | "profiles" | "recommendations";

interface AdminWorkflowBridgeProps {
  currentStep: AdminWorkflowStepId;
  context?: AdminWorkflowContext;
  /** Raw counts per stage; the unit label is intrinsic to the stage. */
  stepStats?: Partial<Record<AdminWorkflowStepId, string>>;
}

const workflowSteps = [
  {
    id: "analysis" as const,
    title: "Analysis",
    href: "/dashboard/admin/github",
    icon: Github,
    description: "Sync repositories and run contributor analysis.",
    statLabel: "repositories",
  },
  {
    id: "profiles" as const,
    title: "Profiles",
    href: "/dashboard/admin/profiles",
    icon: Sparkles,
    description: "Review the skill profiles the analysis produced.",
    statLabel: "profiles",
  },
  {
    id: "recommendations" as const,
    title: "Recommendations",
    href: "/dashboard/admin/recommendations",
    icon: Bot,
    description: "Decide the next action for each developer.",
    statLabel: "recommendations",
  },
];

export function AdminWorkflowBridge({
  currentStep,
  context,
  stepStats,
}: AdminWorkflowBridgeProps) {
  const currentIndex = workflowSteps.findIndex(
    (step) => step.id === currentStep,
  );
  const previousStep =
    currentIndex > 0 ? workflowSteps[currentIndex - 1] : null;
  const nextStep =
    currentIndex < workflowSteps.length - 1
      ? workflowSteps[currentIndex + 1]
      : null;

  const railProgress = (currentIndex / (workflowSteps.length - 1)) * 100;

  return (
    <Card className="mb-6 overflow-hidden border-border/60 bg-background/80 shadow-sm">
      <div
        aria-hidden="true"
        className="h-1 w-full bg-gradient-to-r from-primary via-cyan-500 to-primary/20"
      />
      <CardContent className="p-5">
        {/* ----------------------------- Header ----------------------------- */}
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Analysis pipeline
              </p>
              <span className="text-xs text-muted-foreground">
                Stage {currentIndex + 1} of {workflowSteps.length}
              </span>
            </div>
            {context?.repoName || context?.contributorLogin ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Carrying:</span>
                {context.repoName ? (
                  <Badge variant="outline" className="gap-1.5 border-border/60">
                    <FolderGit2 className="h-3 w-3" />
                    {context.repoName}
                  </Badge>
                ) : null}
                {context.contributorLogin ? (
                  <Badge variant="outline" className="border-border/60">
                    @{context.contributorLogin}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {previousStep ? (
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link href={buildAdminWorkflowHref(previousStep.href, context)}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {previousStep.title}
                </Link>
              </Button>
            ) : null}
            {nextStep ? (
              <Button asChild size="sm" className="group gap-1.5">
                <Link href={buildAdminWorkflowHref(nextStep.href, context)}>
                  Continue to {nextStep.title}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        {/* ------------------------------ Track ------------------------------ */}
        <ol className="relative grid gap-3 md:grid-cols-3">
          {/* Connector rail: sits behind the stage markers on wide screens. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[16.667%] right-[16.667%] top-10 hidden h-0.5 -translate-y-1/2 md:block"
          >
            <div className="h-full w-full rounded-full bg-border" />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-cyan-500 transition-all duration-500 motion-reduce:transition-none"
              style={{ width: `${railProgress}%` }}
            />
          </div>

          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            const isCurrent = index === currentIndex;
            const isCompleted = index < currentIndex;
            const stat = stepStats?.[step.id];

            return (
              <li key={step.id} className="relative">
                <Link
                  href={buildAdminWorkflowHref(step.href, context)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "group flex h-full flex-col items-center rounded-2xl border px-4 pb-4 pt-5 text-center transition-all",
                    isCurrent
                      ? "border-primary/40 bg-primary/[0.06] shadow-sm ring-1 ring-primary/15"
                      : isCompleted
                        ? "border-border/60 bg-background hover:border-primary/30"
                        : "border-dashed border-border/60 bg-muted/10 hover:border-primary/30 hover:bg-muted/20",
                  )}
                >
                  {/* Stage marker */}
                  <span
                    className={cn(
                      "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-background text-sm font-semibold transition-colors",
                      isCurrent
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : isCompleted
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground ring-1 ring-border",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </span>

                  <div className="mt-3 flex items-center gap-1.5">
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        isCurrent ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        !isCurrent && !isCompleted && "text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </p>
                  </div>

                  <p className="mt-1.5 max-w-[16rem] text-xs leading-5 text-muted-foreground">
                    {step.description}
                  </p>

                  {stat ? (
                    <p className="mt-3 text-sm">
                      <span
                        className={cn(
                          "text-lg font-semibold tabular-nums",
                          isCurrent ? "text-primary" : "text-foreground",
                        )}
                      >
                        {stat}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {step.statLabel}
                      </span>
                    </p>
                  ) : null}

                  {isCurrent ? (
                    <span className="mt-3 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      You are here
                    </span>
                  ) : isCompleted ? (
                    <span className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      Done
                    </span>
                  ) : (
                    <span className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                      Up next
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
