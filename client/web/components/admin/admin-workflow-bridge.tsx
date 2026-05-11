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
import {
  type AdminWorkflowContext,
  buildAdminWorkflowHref,
} from "@/lib/admin-workflow";
import { cn } from "@/lib/utils";

export type AdminWorkflowStepId = "analysis" | "profiles" | "recommendations";

interface AdminWorkflowBridgeProps {
  currentStep: AdminWorkflowStepId;
  context?: AdminWorkflowContext;
  stepStats?: Partial<Record<AdminWorkflowStepId, string>>;
}

const workflowSteps = [
  {
    id: "analysis" as const,
    title: "Analysis",
    href: "/dashboard/admin/github",
    icon: Github,
  },
  {
    id: "profiles" as const,
    title: "Profiles",
    href: "/dashboard/admin/profiles",
    icon: Sparkles,
  },
  {
    id: "recommendations" as const,
    title: "Recommendations",
    href: "/dashboard/admin/recommendations",
    icon: Bot,
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

  return (
    <Card className="mb-4 border-border/60 bg-background/75 shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-cyan-500/25 bg-cyan-500/10 text-cyan-700"
              >
                Workflow
              </Badge>
              {context?.repoName ? (
                <Badge variant="outline" className="border-border/60">
                  Repo: {context.repoName}
                </Badge>
              ) : null}
              {context?.contributorLogin ? (
                <Badge variant="outline" className="border-border/60">
                  @{context.contributorLogin}
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {previousStep ? (
                <Link
                  href={buildAdminWorkflowHref(previousStep.href, context)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 font-medium text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {previousStep.title}
                </Link>
              ) : null}
              {nextStep ? (
                <Link
                  href={buildAdminWorkflowHref(nextStep.href, context)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-3 py-1.5 font-medium text-foreground transition hover:border-primary/30 hover:text-primary"
                >
                  {nextStep.title}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;
              const isCurrent = step.id === currentStep;
              const isCompleted = index < currentIndex;

              return (
                <Link
                  key={step.id}
                  href={buildAdminWorkflowHref(step.href, context)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                    isCurrent
                      ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-800"
                      : "border-border/60 bg-muted/10 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full",
                      isCurrent
                        ? "bg-cyan-500/15 text-cyan-700"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="font-medium">{step.title}</span>
                  {stepStats?.[step.id] ? (
                    <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-semibold text-foreground">
                      {stepStats[step.id]}
                    </span>
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
