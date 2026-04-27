"use client";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Finding {
  file_path: string;
  line: number | null;
  category: string;
  skill: string;
  title: string;
  message: string;
  severity: Severity;
  confidence: number;
  rule_id: string;
  source: string;
  evidence: string[];
  related_symbols: string[];
  tags: string[];
}

export interface SkillSummary {
  skill: string;
  issue_count: number;
  highest_severity: Severity;
  average_confidence: number;
  example_titles: string[];
}

export interface LearningResource {
  skill: string;
  title: string;
  type: string;
  url: string;
}

export interface ContributorAnalysisSummary {
  version?: string;
  dominant_language?: string;
  commit_topics?: string[];
  quality_score?: number;
  summary?: {
    finding_count: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
  };
  weakness_scores?: Record<string, number>;
  skills?: SkillSummary[];
  findings?: Finding[];
  learning_resources?: LearningResource[];
  analysis_metadata?: Record<string, any>;
}

export interface ContributorProfile {
  profileId: string;
  contributorLogin: string;
  contributorName?: string;
  contributorEmail?: string;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  repositoryName: string;
  repositoryId?: string;
  status: string;
  analyzedAt: string | null;
  qualityScore: number | null;
  skillLevel: string | null;
  strengths?: string[];
  topWeaknesses: Array<{ category?: string; score?: number }>;
  recommendations: Array<{ weakness?: string; action?: string }>;
  findingsSummary: {
    finding_count?: number;
    high_count?: number;
    critical_count?: number;
    medium_count?: number;
    low_count?: number;
  } | null;
  skills: Array<{ skill?: string; issue_count?: number; highest_severity?: Severity; average_confidence?: number; example_titles?: string[] }>;
  analysisSummary?: ContributorAnalysisSummary | null;
  metadata?: Record<string, any>;
}

export type RecommendationType = "mentorship" | "learning_path" | "docs_review";

export interface RecommendationCase {
  id: string;
  repository_id: string;
  contributor_login: string;
  recommendation_type: RecommendationType;
  status: "open" | "assigned" | "completed" | "dismissed";
  priority_score: number;
  quality_score: number | null;
  title: string;
  description: string;
  mentor_id?: string | null;
  mentor_snapshot?: {
    id?: string;
    name?: string;
    email?: string;
    username?: string;
    role?: string;
  } | null;
  learning_path?: {
    durationWeeks?: number;
    steps?: Array<{
      order: number;
      skill: string;
      goal: string;
      resources?: Array<{ title: string; type: string; url: string }>;
    }>;
  } | null;
  docs_review?: {
    checklist?: Array<{
      title: string;
      skill: string;
      file: string;
      note: string;
    }>;
    resources?: Array<{ title: string; type: string; url: string }>;
  } | null;
  weakness_snapshot?: {
    topWeaknesses?: Array<{ skill: string; score: number }>;
    weaknessScores?: Record<string, number>;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface RepositoryRecord {
  id: string;
  repo_name: string;
  analysis_metadata: {
    contributorProfiles?: Record<string, ContributorProfile>;
  } | null;
}

export const recommendationKey = (repositoryId: string, contributorLogin: string) =>
  `${repositoryId}:${String(contributorLogin || "").trim().toLowerCase()}`;

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const getInitials = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "GH";

export const getContributorAvatarUrl = (
  contributorLogin: string,
  avatarUrl?: string | null,
) => {
  if (avatarUrl) return avatarUrl;
  const normalizedLogin = String(contributorLogin || "").trim();
  if (!normalizedLogin) return undefined;
  return `https://github.com/${normalizedLogin}.png?size=240`;
};

export const statusTone = (status: string | null) => {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
    case "failed":
      return "bg-red-500/10 text-red-700 border-red-500/30";
    case "pending":
    case "in_progress":
      return "bg-sky-500/10 text-sky-700 border-sky-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const formatLabel = (value: string) => value.replace(/_/g, " ");

export const confidencePercent = (value: number) =>
  `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

export const scorePercent = (value: number) =>
  Math.max(0, Math.min(100, (value / 10) * 100));

export const severityTone: Record<Severity, string> = {
  critical: "bg-red-500/15 text-red-700 border-red-500/30",
  high: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
  medium: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  low: "bg-blue-500/15 text-blue-700 border-blue-500/30",
};

export const recommendationTypeTone: Record<RecommendationType, string> = {
  mentorship: "bg-violet-500/10 text-violet-700 border-violet-500/30",
  learning_path: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",
  docs_review: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

export const recommendationStatusTone = (status: string | null) => {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
    case "assigned":
      return "bg-blue-500/10 text-blue-700 border-blue-500/30";
    case "open":
      return "bg-sky-500/10 text-sky-700 border-sky-500/30";
    case "dismissed":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const normalizeContributorAnalysisSummary = (
  rawSummary: unknown,
): ContributorAnalysisSummary | null => {
  if (!rawSummary) return null;

  let parsed: any = rawSummary;
  if (typeof rawSummary === "string") {
    try {
      parsed = JSON.parse(rawSummary);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
  const qualityScore =
    toNumber(parsed.quality_score) ??
    toNumber(parsed.qualityScore) ??
    toNumber(parsed.score);

  const summaryCounts =
    parsed.summary && typeof parsed.summary === "object" ? parsed.summary : {};

  return {
    version: parsed.version,
    dominant_language: parsed.dominant_language ?? parsed.dominantLanguage,
    commit_topics: Array.isArray(parsed.commit_topics)
      ? parsed.commit_topics
      : Array.isArray(parsed.commitTopics)
        ? parsed.commitTopics
        : [],
    quality_score: qualityScore ?? undefined,
    summary: {
      finding_count:
        toNumber(summaryCounts.finding_count) ??
        toNumber(summaryCounts.findingCount) ??
        findings.length,
      critical_count:
        toNumber(summaryCounts.critical_count) ??
        toNumber(summaryCounts.criticalCount) ??
        findings.filter((item: any) => item?.severity === "critical").length,
      high_count:
        toNumber(summaryCounts.high_count) ??
        toNumber(summaryCounts.highCount) ??
        findings.filter((item: any) => item?.severity === "high").length,
      medium_count:
        toNumber(summaryCounts.medium_count) ??
        toNumber(summaryCounts.mediumCount) ??
        findings.filter((item: any) => item?.severity === "medium").length,
      low_count:
        toNumber(summaryCounts.low_count) ??
        toNumber(summaryCounts.lowCount) ??
        findings.filter((item: any) => item?.severity === "low").length,
    },
    weakness_scores:
      parsed.weakness_scores && typeof parsed.weakness_scores === "object"
        ? parsed.weakness_scores
        : parsed.weaknessScores && typeof parsed.weaknessScores === "object"
          ? parsed.weaknessScores
          : undefined,
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    findings,
    learning_resources: Array.isArray(parsed.learning_resources)
      ? parsed.learning_resources
      : Array.isArray(parsed.learningResources)
        ? parsed.learningResources
        : [],
    analysis_metadata:
      parsed.analysis_metadata && typeof parsed.analysis_metadata === "object"
        ? parsed.analysis_metadata
        : undefined,
  };
};
