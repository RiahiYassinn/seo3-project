"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Github,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AdminWorkflowStepId =
  | "analysis"
  | "profiles"
  | "recommendations";

type WorkflowStepStat = {
  value: string;
  helper: string;
};

interface AdminWorkflowBridgeProps {
  currentStep: AdminWorkflowStepId;
  contextMessage: string;
  stepStats?: Partial<Record<AdminWorkflowStepId, WorkflowStepStat>>;
}

const workflowSteps = [
  {
    id: "analysis" as const,
    title: "GitHub Analysis",
    description: "Choose repositories, run contributor batches, and watch live progress.",
    href: "/dashboard/admin/github",
    icon: Github,
  },
  {
    id: "profiles" as const,
    title: "Developer Profiles",
    description: "Inspect weaknesses, quality signals, and the evidence behind each profile.",
    href: "/dashboard/admin/profiles",
    icon: Sparkles,
  },
  {
    id: "recommendations" as const,
    title: "Recommendations",
    description: "Turn completed profiles into mentorship, learning path, or docs review actions.",
    href: "/dashboard/admin/recommendations",
    icon: Bot,
  },
];

export function AdminWorkflowBridge({
  currentStep,
  contextMessage,
  stepStats,
}: AdminWorkflowBridgeProps) {
  const currentIndex = workflowSteps.findIndex((step) => step.id === currentStep);
  const previousStep = currentIndex > 0 ? workflowSteps[currentIndex - 1] : null;
  const nextStep =
    currentIndex < workflowSteps.length - 1
      ? workflowSteps[currentIndex + 1]
      : null;

  return (
    <Card className="mb-6 overflow-hidden border-border/60 bg-background/80 shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">
                Connected Workflow
              </p>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                {contextMessage}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {previousStep ? (
                <Link
                  href={previousStep.href}
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:text-primary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {previousStep.title}
                </Link>
              ) : null}

              {nextStep ? (
                <Link
                  href={nextStep.href}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                >
                  {nextStep.title}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;
              const isCurrent = step.id === currentStep;
              const isCompleted = index < currentIndex;
              const stat = stepStats?.[step.id];

              return (
                <Link
                  key={step.id}
                  href={step.href}
                  className={cn(
                    "rounded-[1.5rem] border p-4 transition",
                    isCurrent
                      ? "border-cyan-500/40 bg-cyan-500/10 shadow-sm"
                      : "border-border/60 bg-muted/15 hover:border-primary/30 hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl",
                        isCurrent
                          ? "bg-cyan-500/15 text-cyan-700"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(
                        "border-border/60",
                        isCurrent &&
                          "border-cyan-500/30 bg-cyan-500/10 text-cyan-700",
                        isCompleted &&
                          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
                      )}
                    >
                      {isCurrent ? (
                        "Current"
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Done
                        </span>
                      ) : (
                        `Step ${index + 1}`
                      )}
                    </Badge>
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <p className="mt-1 text-base font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.description}
                  </p>

                  {stat ? (
                    <div className="mt-4 rounded-2xl border border-border/60 bg-background/90 p-3">
                      <p className="text-xl font-semibold">{stat.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {stat.helper}
                      </p>
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
