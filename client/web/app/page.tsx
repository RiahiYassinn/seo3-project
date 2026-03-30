"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Code as Code2,
  TrendingUp,
  Users,
  Brain,
  Zap,
  Target,
  GitBranch,
  MessageSquare,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      <section className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-secondary/5 pt-20 pb-32">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.5))]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-br from-primary via-secondary to-accent bg-clip-text text-transparent">
              SEO3
            </h1>

            <p className="text-2xl md:text-3xl font-semibold text-foreground mb-4">
              Technical Skill Intelligence System
            </p>

            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-12">
              Automatically analyze developers&apos; technical contributions to
              identify strengths and weaknesses, and suggest tailored learning
              paths or mentors for your development team.
            </p>

            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/login">
                <Button size="lg" className="group">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-20">
            {[
              {
                icon: Code2,
                title: "Code Analysis",
                description: "Analyze commits and code reviews",
                color: "text-primary",
              },
              {
                icon: TrendingUp,
                title: "Skill Mapping",
                description: "Track technical growth over time",
                color: "text-secondary",
              },
              {
                icon: Brain,
                title: "Smart Recommendations",
                description: "AI-powered learning suggestions",
                color: "text-accent",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
              >
                <CardHeader>
                  <feature.icon className={`w-12 h-12 mb-4 ${feature.color}`} />
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to build a highly skilled development team
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: GitBranch,
                title: "Commit Analysis",
                description:
                  "Automatically analyze git commits to understand coding patterns and expertise areas",
                color: "bg-primary/10 text-primary",
              },
              {
                icon: MessageSquare,
                title: "Code Review Intelligence",
                description:
                  "Extract insights from code reviews to identify knowledge sharing patterns",
                color: "bg-secondary/10 text-secondary",
              },
              {
                icon: Target,
                title: "Skill Gap Detection",
                description:
                  "Identify skill gaps and areas for improvement across your team",
                color: "bg-accent/10 text-accent",
              },
              {
                icon: Users,
                title: "Mentor Matching",
                description:
                  "Connect developers with the right mentors based on skill analysis",
                color: "bg-primary/10 text-primary",
              },
              {
                icon: TrendingUp,
                title: "Learning Paths",
                description:
                  "Generate personalized learning recommendations for each developer",
                color: "bg-secondary/10 text-secondary",
              },
              {
                icon: Brain,
                title: "AI-Powered Insights",
                description:
                  "Leverage machine learning for deeper understanding of technical capabilities",
                color: "bg-accent/10 text-accent",
              },
            ].map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div
                    className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4`}
                  >
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Simple, automated, and powerful
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: "01",
                title: "Connect Your Repositories",
                description:
                  "Link your GitHub, GitLab, or other version control systems to SEO3",
              },
              {
                step: "02",
                title: "Automatic Analysis",
                description:
                  "Our AI analyzes commits, code reviews, and messages to build skill profiles",
              },
              {
                step: "03",
                title: "Get Insights & Recommendations",
                description:
                  "Receive personalized learning paths and mentor recommendations for your team",
              },
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary via-secondary to-accent text-white text-2xl font-bold mb-6">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold mb-4">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-primary via-secondary to-accent text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Transform Your Team&apos;s Skills?
          </h2>
          <p className="text-lg mb-8 text-white/90">
            Join leading development teams using SEO3 to build better skills
          </p>
          <Link href="/register">
            <Button
              size="lg"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90 group"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              SEO3 - Technical Skill Intelligence System
            </p>
            <p className="text-sm text-muted-foreground">Powered by Wevioo</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
