import { GitCommit, Sparkles, Target, TrendingUp } from "lucide-react";

const skills = [
  { label: "TypeScript", level: 86, tone: "bg-primary" },
  { label: "System design", level: 64, tone: "bg-cyan-500" },
  { label: "Testing", level: 38, tone: "bg-amber-500" },
];

/**
 * Illustrative product mock for the hero. Decorative: the surrounding copy
 * carries the meaning, so it is hidden from assistive tech.
 */
export function ProductPreview() {
  return (
    <div aria-hidden="true" className="relative select-none">
      {/* Ambient glow */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-primary/20 via-cyan-500/10 to-transparent blur-2xl" />

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl shadow-primary/5 backdrop-blur">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <div className="ml-3 flex-1 rounded-md bg-background/70 px-3 py-1 text-[11px] text-muted-foreground">
            dev.lab / skill-profile
          </div>
        </div>

        <div className="space-y-5 p-5">
          {/* Developer identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-cyan-500 text-sm font-semibold text-white">
              MB
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Maya Ben Ali</p>
              <p className="text-xs text-muted-foreground">
                @maya-dev · 214 commits analyzed
              </p>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
              Profile fresh
            </span>
          </div>

          {/* Skill bars */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Skill signal
            </div>
            {skills.map((skill) => (
              <div key={skill.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{skill.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {skill.level}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                  <div
                    className={`h-full rounded-full ${skill.tone}`}
                    style={{ width: `${skill.level}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Detected gap + recommendation */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300">
                <Target className="h-3.5 w-3.5" />
                Gap detected
              </div>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                Low test coverage on 4 merged pull requests.
              </p>
            </div>
            <div className="rounded-xl border border-primary/25 bg-primary/[0.07] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Path ready
              </div>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                5 steps · ~6h · mentor suggested
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating activity chip */}
      <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-border/70 bg-background/95 px-3.5 py-2.5 shadow-lg backdrop-blur sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
          <GitCommit className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold leading-none">Analysis complete</p>
          <p className="mt-1 text-[11px] leading-none text-muted-foreground">
            12 repositories · just now
          </p>
        </div>
      </div>
    </div>
  );
}
