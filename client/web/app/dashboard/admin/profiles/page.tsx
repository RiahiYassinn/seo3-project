"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowUpRight,
  CircleAlert,
  FolderGit2,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import {
  type ContributorProfile,
  type RepositoryRecord,
  getContributorAvatarUrl,
  getInitials,
  statusTone,
} from "./profile-types";

export default function AdminProfilesPage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadRepositories = async () => {
      try {
        const { data } = await api.get<RepositoryRecord[]>(
          "/github/repositories",
        );
        setRepositories(data || []);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ??
            err.message ??
            "Failed to load developer profiles",
        );
      } finally {
        setLoading(false);
      }
    };

    loadRepositories();
  }, []);

  const profiles = useMemo(() => {
    return repositories
      .flatMap((repository) =>
        Object.values(repository.analysis_metadata?.contributorProfiles || {}),
      )
      .sort((left, right) => {
        const leftTime = left.analyzedAt
          ? new Date(left.analyzedAt).getTime()
          : 0;
        const rightTime = right.analyzedAt
          ? new Date(right.analyzedAt).getTime()
          : 0;
        return rightTime - leftTime;
      });
  }, [repositories]);

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return profiles;

    return profiles.filter((profile) => {
      return (
        profile.contributorLogin.toLowerCase().includes(query) ||
        profile.repositoryName.toLowerCase().includes(query) ||
        profile.topWeaknesses.some((weakness) =>
          String(weakness.category || "")
            .toLowerCase()
            .includes(query),
        )
      );
    });
  }, [profiles, searchQuery]);

  return (
    <AdminShell
      title="Developer Skill Profiles"
      subtitle="Browse the generated contributor profiles separately from the GitHub analysis flow so reviewing weaknesses and recommendations stays focused."
      actions={
        <Button
          onClick={() => router.push("/dashboard/admin/github")}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Back to Analysis
        </Button>
      }
    >
      {error && (
        <Alert className="mb-6 border-destructive/40 bg-destructive/10">
          <CircleAlert className="h-4 w-4" />
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Profiles</p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "--" : profiles.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Repositories covered
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "--" : repositories.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-background/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Completed profiles</p>
            <p className="mt-2 text-2xl font-semibold">
              {loading
                ? "--"
                : profiles.filter((profile) => profile.status === "completed")
                    .length}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/60 bg-background/80 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Generated profiles
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Search by contributor, repository, or weakness area.
              </p>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search profiles"
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProfiles.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredProfiles.map((profile) => (
                <div
                  key={profile.profileId}
                  className="group cursor-pointer rounded-[1.75rem] border border-border/60 bg-muted/15 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background"
                  onClick={() =>
                    router.push(
                      `/dashboard/admin/profiles/${encodeURIComponent(profile.profileId)}`,
                    )
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(
                        `/dashboard/admin/profiles/${encodeURIComponent(profile.profileId)}`,
                      );
                    }
                  }}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-12 w-12 border border-border/60">
                        <AvatarImage
                          src={getContributorAvatarUrl(
                            profile.contributorLogin,
                            profile.avatarUrl,
                          )}
                          alt={`${profile.contributorLogin} GitHub avatar`}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(profile.contributorLogin)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-lg font-semibold">
                          @{profile.contributorLogin}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {profile.repositoryName}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={statusTone(profile.status)}
                    >
                      {profile.status}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <span>Open detailed analysis</span>
                    <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-border/60 bg-background p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Quality score
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {profile.qualityScore !== null
                          ? `${profile.qualityScore}/10`
                          : "--"}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-border/60 bg-background p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Skill level
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {profile.skillLevel || "--"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold">Top weaknesses</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.topWeaknesses?.length ? (
                        profile.topWeaknesses.slice(0, 3).map((weakness) => (
                          <Badge
                            key={`${profile.profileId}-${weakness.category}`}
                            variant="secondary"
                          >
                            {weakness.category || "Unknown weakness"}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Weakness insights will appear when analysis completes.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold">Recommendations</p>
                    <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {profile.recommendations?.length ? (
                        profile.recommendations
                          .slice(0, 2)
                          .map((recommendation, index) => (
                            <div
                              key={`${profile.profileId}-${index}`}
                              className="rounded-2xl border border-border/60 bg-background px-3 py-2"
                            >
                              {recommendation.action || recommendation.weakness}
                            </div>
                          ))
                      ) : (
                        <p>No recommendations yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-border/60 bg-background p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Findings</span>
                      <span className="font-medium">
                        {profile.findingsSummary?.finding_count ?? 0}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>
                        Critical: {profile.findingsSummary?.critical_count ?? 0}
                      </span>
                      <span>
                        High: {profile.findingsSummary?.high_count ?? 0}
                      </span>
                      <span>Skills: {profile.skills?.length ?? 0}</span>
                    </div>
                  </div>

                  {profile.profileUrl && (
                    <a
                      href={profile.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <FolderGit2 className="h-4 w-4" />
                      View GitHub profile
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-border/60 p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="mt-4 text-lg font-semibold">No profiles found</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Run contributor analysis from the GitHub Analysis page to
                generate profiles here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
