"use client";

import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Logo } from "@/components/logo";
import { ProductPreview } from "@/components/landing/product-preview";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Brain,
  Check,
  GitBranch,
  MessageSquare,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

const features = [
  {
    icon: GitBranch,
    title: "Commit analysis",
    description:
      "Every merged change is parsed for language, complexity, and ownership so expertise is measured from real work, not self-assessment.",
    tone: "bg-primary/10 text-primary",
  },
  {
    icon: MessageSquare,
    title: "Code review intelligence",
    description:
      "Review threads reveal who teaches, who unblocks, and where knowledge stays trapped with a single person.",
    tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  {
    icon: Target,
    title: "Skill gap detection",
    description:
      "Gaps are ranked by severity and backed by evidence — the exact files, findings, and pull requests behind each one.",
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: Route,
    title: "Personalised learning paths",
    description:
      "Each gap becomes an ordered set of steps with an effort estimate, so improvement has a start and a finish.",
    tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    icon: Users,
    title: "Mentor matching",
    description:
      "Developers request the mentor whose profile actually covers the gap, and sessions are scheduled in the same flow.",
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Brain,
    title: "AI-generated recommendations",
    description:
      "Priority and confidence scores put the highest-impact recommendation at the top of the queue.",
    tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
];

const roles = [
  {
    label: "Developers",
    headline: "See what to learn next",
    points: [
      "A recommendation feed ranked by priority",
      "Learning paths with evidence from your own PRs",
      "Request a mentor without leaving the page",
    ],
  },
  {
    label: "Tech leads",
    headline: "Mentor where it counts",
    points: [
      "One queue of incoming mentorship requests",
      "Accept, decline, or schedule in a click",
      "Context on the gap before you say yes",
    ],
  },
  {
    label: "Admins",
    headline: "Steer the whole team",
    points: [
      "Team-wide skill coverage at a glance",
      "Repository and user management",
      "Notifications for everything that matters",
    ],
  },
];

const steps = [
  {
    step: "01",
    title: "Connect your repositories",
    description:
      "Link a GitHub account with a personal access token. Nothing else to install.",
  },
  {
    step: "02",
    title: "Let the analysis run",
    description:
      "Commits, reviews, and discussions are turned into an evidence-backed skill profile per developer.",
  },
  {
    step: "03",
    title: "Act on the recommendations",
    description:
      "Pick up a learning path or a mentor, then track progress as the profile updates.",
  },
];

const faqs = [
  {
    question: "What does Dev.Lab actually read?",
    answer:
      "Commits, pull requests, and code review conversations from the repositories you connect. Analysis produces a skill profile, detected gaps, and recommendations — each traceable back to the contribution it came from.",
  },
  {
    question: "Which platforms are supported?",
    answer:
      "GitHub today, using a personal access token scoped to the repositories you choose. Support for other version control systems is on the roadmap.",
  },
  {
    question: "Is this used to rank or grade developers?",
    answer:
      "No. Profiles are built to route learning and mentorship, not to score people against each other. Every recommendation shows the evidence behind it so it can be discussed, adjusted, or dismissed.",
  },
  {
    question: "How do mentorship requests work?",
    answer:
      "When a recommendation calls for mentorship, the developer picks an available mentor and sends a request. The mentor sees it in their queue with the full context, then accepts, declines, or schedules a session.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ------------------------------- Hero ------------------------------- */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_70%_-10%,hsl(var(--primary)/0.14),transparent),radial-gradient(45rem_30rem_at_10%_10%,rgba(6,182,212,0.10),transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        />

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-24 xl:px-8">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 motion-reduce:animate-none">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Technical skill intelligence
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl xl:text-6xl">
              Turn your team&apos;s commits into a{" "}
              <span className="bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
                living skill map
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Dev.Lab reads the work your developers already ship — commits,
              reviews, discussions — to reveal real strengths, surface the gaps
              that slow delivery, and match each person with the right learning
              path or mentor.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="group h-12 px-6 text-base">
                <Link href="/login">
                  Get started
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base"
              >
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Connects to GitHub
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Evidence behind every insight
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4" />
                Set up in minutes
              </span>
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-6 delay-150 duration-700 motion-reduce:animate-none lg:pl-6">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ------------------------------ Features ---------------------------- */}
      <section
        id="features"
        className="scroll-mt-20 border-t border-border/60 py-20 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Capabilities
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything the analysis gives you
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Six connected capabilities that take a repository from raw history
              to a decision someone can act on today.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border/60 bg-background/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 motion-reduce:hover:translate-y-0"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.tone}`}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- Roles ------------------------------ */}
      <section
        id="roles"
        className="scroll-mt-20 border-t border-border/60 bg-muted/20 py-20 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              For your team
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              One system, three points of view
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Everyone lands on the workspace built for their role — no digging
              for the part that concerns them.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {roles.map((role) => (
              <div
                key={role.label}
                className="rounded-2xl border border-border/60 bg-background p-7 shadow-sm"
              >
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  {role.label}
                </span>
                <h3 className="mt-4 text-xl font-semibold">{role.headline}</h3>
                <ul className="mt-5 space-y-3">
                  {role.points.map((point) => (
                    <li key={point} className="flex gap-3 text-sm leading-6">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- How it works -------------------------- */}
      <section
        id="how-it-works"
        className="scroll-mt-20 border-t border-border/60 py-20 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              From repository to recommendation
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Three steps, then the profile keeps itself current as your team
              ships.
            </p>
          </div>

          <ol className="relative mt-14 grid gap-10 lg:grid-cols-3 lg:gap-8">
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-primary/40 via-border to-transparent lg:block"
            />
            {steps.map((item) => (
              <li key={item.step} className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-background text-lg font-bold text-primary shadow-sm">
                  {item.step}
                </div>
                <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------- FAQ ------------------------------- */}
      <section
        id="faq"
        className="scroll-mt-20 border-t border-border/60 bg-muted/20 py-20 lg:py-28"
      >
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Questions teams ask first
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Still unsure? Create an account and connect a single repository to
              see it on your own code.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger className="text-left text-base font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-6 text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ----------------------------- Final CTA ---------------------------- */}
      <section className="border-t border-border/60 py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-cyan-500/[0.06] to-transparent px-6 py-14 text-center sm:px-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(30rem_18rem_at_50%_0%,hsl(var(--primary)/0.16),transparent)]"
            />
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to see where your team really stands?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
              Connect a repository and get your first evidence-backed skill
              profile — no rollout project required.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="group h-12 px-7 text-base">
                <Link href="/register">
                  Create your account
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-7 text-base"
              >
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------- Footer ----------------------------- */}
      <footer className="border-t border-border/60 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="max-w-xs">
              <Logo className="h-9" />
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Technical skill intelligence for engineering teams — built on
                the work your developers already do.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <div>
                <p className="text-sm font-semibold">Product</p>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li>
                    <Link href="#features" className="hover:text-foreground">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link href="#roles" className="hover:text-foreground">
                      For your team
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="#how-it-works"
                      className="hover:text-foreground"
                    >
                      How it works
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold">Resources</p>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li>
                    <Link href="#faq" className="hover:text-foreground">
                      FAQ
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-foreground">
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" className="hover:text-foreground">
                      Create account
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold">Account</p>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li>
                    <Link
                      href="/forgot-password"
                      className="hover:text-foreground"
                    >
                      Reset password
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/verify-email"
                      className="hover:text-foreground"
                    >
                      Verify email
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Dev.Lab. All rights reserved.</p>
            <p>Technical Skill Intelligence System</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
