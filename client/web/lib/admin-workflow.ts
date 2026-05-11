"use client";

export type AdminWorkflowContext = {
  repoId?: string;
  repoName?: string;
  contributorLogin?: string;
  profileId?: string;
  recommendationId?: string;
};

type SearchParamReader = {
  get: (key: string) => string | null;
} | null | undefined;

const clean = (value: string | null | undefined) => {
  const normalized = String(value || "").trim();
  return normalized || undefined;
};

export const readAdminWorkflowContext = (
  searchParams: SearchParamReader,
): AdminWorkflowContext => ({
  repoId: clean(searchParams?.get("repo")),
  contributorLogin: clean(searchParams?.get("contributor")),
  profileId: clean(searchParams?.get("profile")),
  recommendationId: clean(searchParams?.get("recommendation")),
});

export const buildAdminWorkflowHref = (
  pathname: string,
  context?: AdminWorkflowContext,
) => {
  if (!context) return pathname;

  const params = new URLSearchParams();

  if (clean(context.repoId)) {
    params.set("repo", clean(context.repoId)!);
  }
  if (clean(context.contributorLogin)) {
    params.set("contributor", clean(context.contributorLogin)!);
  }
  if (clean(context.profileId)) {
    params.set("profile", clean(context.profileId)!);
  }
  if (clean(context.recommendationId)) {
    params.set("recommendation", clean(context.recommendationId)!);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};