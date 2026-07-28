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
  mentorship_session_scheduled_at?: string | null;
  mentorship_session_note?: string | null;
  context_snapshot?: {
    repoName?: string;
    contributorLogin?: string;
    dominantLanguage?: string | null;
    commitTopics?: string[];
    strengths?: string[];
    detectedGaps?: Array<{
      key: string;
      label: string;
      score: number;
      severity: Severity;
      evidence?: string[];
    }>;
    repeatedWeaknesses?: string[];
    qualityTrendDelta?: number | null;
    risk?: Record<string, any>;
    llmProvider?: string;
    llmModel?: string;
    generatedAt?: string;
    profileSignals?: Record<string, any>;
  } | null;
  evidence_snapshot?: {
    recommendationType?: RecommendationType;
    topWeaknesses?: Array<{ skill: string; score: number }>;
    keyFindings?: Array<{
      title: string;
      skill: string;
      severity: Severity;
      confidence: number;
      file: string;
    }>;
    strengths?: string[];
    repeatedWeaknesses?: string[];
    successCriteria?: string[];
    retrievedCoursesByGap?: Array<{
      gapKey: string;
      gapLabel: string;
      courses: Array<{
        courseId: string;
        title: string;
        url: string;
        description: string;
        skills: string[];
        partner?: string | null;
        type?: string | null;
        rating?: number | null;
        reviewCount?: number | null;
        vectorScore?: number | null;
      }>;
    }>;
  } | null;
  target_skills?: string[] | null;
  effort_level?: "light" | "moderate" | "intensive" | null;
  due_in_days?: number | null;
  confidence_score?: number | null;
  learning_path?: {
    overview?: string;
    tone?: string;
    estimatedTotalHours?: number;
    durationWeeks?: number;
    targetSkills?: string[];
    steps?: Array<{
      order: number;
      skill?: string;
      title?: string;
      goal: string;
      focus?: string;
      why_it_matters?: string;
      practice_task?: string;
      success_signal?: string;
      estimated_hours?: number;
      gap_keys?: string[];
      recommended_course_ids?: string[];
      recommended_courses?: Array<{
        courseId: string;
        title: string;
        url: string;
        description: string;
        skills: string[];
        partner?: string | null;
        type?: string | null;
        rating?: number | null;
        reviewCount?: number | null;
        vectorScore?: number | null;
      }>;
      success_criteria?: string[];
      resources?: Array<{ title: string; type: string; url: string }>;
    }>;
  } | null;
  docs_review?: {
    checklist?: Array<{
      title: string;
      skill: string;
      file: string;
      note: string;
      success_criteria?: string;
    }>;
    focus_areas?: string[];
    resources?: Array<{ title: string; type: string; url: string }>;
  } | null;
  weakness_snapshot?: {
    topWeaknesses?: Array<{ skill: string; score: number }>;
    weaknessScores?: Record<string, number>;
  } | null;
  decision_reasons?: Record<string, any> | null;
  previous_recommendation_id?: string | null;
  outcome_status?: "pending" | "improving" | "stalled" | "resolved" | null;
  outcome_metrics?: Record<string, any> | null;
  feedback?: Record<string, any> | null;
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
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "failed":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30";
    case "pending":
    case "in_progress":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const formatLabel = (value: string) => {
  if (!value) return "";
  return value.replace(/_/g, " ");
};

export const confidencePercent = (value: number) =>
  `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

export const scorePercent = (value: number) =>
  Math.max(0, Math.min(100, (value / 10) * 100));

/** Severity escalates warm-to-cool so rank is readable without the label. */
export const severityTone: Record<Severity, string> = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  low: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

export const recommendationTypeTone: Record<RecommendationType, string> = {
  mentorship:
    "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  learning_path:
    "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  docs_review:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

/**
 * Priority bands so a raw score reads as urgency at a glance. Shared by the
 * developer feed, the mentor queue, and the detail panel so they agree.
 */
export const priorityBand = (score: number | null | undefined) => {
  const value = typeof score === "number" ? score : 0;

  if (value >= 70) {
    return {
      label: "High priority",
      short: "High",
      badge:
        "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      rail: "bg-rose-500",
      text: "text-rose-600 dark:text-rose-400",
    };
  }

  if (value >= 40) {
    return {
      label: "Medium priority",
      short: "Medium",
      badge:
        "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      rail: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
    };
  }

  return {
    label: "Low priority",
    short: "Low",
    badge: "border-border/60 bg-muted text-muted-foreground",
    rail: "bg-border",
    text: "text-muted-foreground",
  };
};

export const recommendationStatusTone = (status: string | null) => {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "assigned":
      return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30";
    case "open":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30";
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
