import { RecommendationType } from './entities/recommendation-case.entity';

export interface AnalysisSummary {
  quality_score?: number;
  dominant_language?: string;
  commit_topics?: string[];
  strengths?: string[];
  weakness_scores?: Record<string, number>;
  summary?: {
    finding_count?: number;
    critical_count?: number;
    high_count?: number;
    medium_count?: number;
    low_count?: number;
  };
  skills?: Array<{
    skill: string;
    issue_count: number;
    highest_severity: 'low' | 'medium' | 'high' | 'critical';
    average_confidence: number;
    example_titles: string[];
  }>;
  findings?: Array<{
    file_path: string;
    line: number | null;
    skill: string;
    title: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  }>;
  learning_resources?: Array<{
    skill: string;
    title: string;
    type: string;
    url: string;
  }>;
  analysis_metadata?: {
    skill_profile_inputs?: {
      languages?: string[];
      frameworks?: string[];
      roles_touched?: string[];
      changed_symbols?: string[];
      positive_signal_counts?: Record<string, number>;
      negative_finding_counts?: Record<string, number>;
    };
    [key: string]: any;
  };
}

export interface AnalysisCompletedEvent {
  repositoryId: string;
  repoName?: string;
  developerId?: string;
  requestedByUserId?: string;
  githubUsername?: string;
  analyzedAt?: string;
  summary?: AnalysisSummary;
  detectedGaps?: string[];
  metadata?: Record<string, any>;
}

export interface RecommendationHistorySnapshot {
  id: string;
  recommendationType: RecommendationType;
  status: string;
  qualityScore: number | null;
  createdAt: string;
}

export interface DetectedGap {
  key: string;
  label: string;
  score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string[];
}

export interface CourseCatalogDocument {
  courseId: string;
  title: string;
  url: string;
  description: string;
  skills: string[];
  partner: string | null;
  type: string | null;
  rating: number | null;
  reviewCount: number | null;
  searchableText: string;
  embedding: number[];
  updatedAt: string;
}

export interface RetrievedCourse {
  courseId: string;
  title: string;
  url: string;
  description: string;
  skills: string[];
  partner: string | null;
  type: string | null;
  rating: number | null;
  reviewCount: number | null;
  vectorScore: number | null;
}

export interface GapCourseMatch {
  gap: DetectedGap;
  courses: RetrievedCourse[];
}

export interface LearningPathStep {
  order: number;
  title: string;
  goal: string;
  why_it_matters: string;
  practice_task: string;
  success_signal: string;
  estimated_hours: number;
  gap_keys: string[];
  recommended_course_ids: string[];
  recommended_courses?: RetrievedCourse[];
}

export interface GeneratedLearningPath {
  title: string;
  summary: string;
  tone: string;
  estimated_total_hours: number;
  steps: LearningPathStep[];
}

export interface RecommendationGenerationResult {
  detectedGaps: DetectedGap[];
  gapMatches: GapCourseMatch[];
  generatedPath: GeneratedLearningPath;
  provider: 'gemini' | 'groq' | 'fallback';
  model: string;
  notificationSummary: string;
}
