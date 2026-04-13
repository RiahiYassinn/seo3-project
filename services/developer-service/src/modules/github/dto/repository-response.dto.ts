export class RepositoryResponseDto {
  id: string;
  repo_name: string;
  repo_url: string;
  repo_description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  is_analyzed: boolean;
  analysis_status: string | null;
  analysis_progress: number;
  analysis_current_stage: string | null;
  analysis_summary: Record<string, any> | null;
  analysis_detected_skills: Record<string, any>[] | null;
  analysis_metadata: Record<string, any> | null;
  last_analyzed_at: Date | null;
  last_synced: Date;

  static fromEntity(entity: any): RepositoryResponseDto {
    return {
      id: entity.id,
      repo_name: entity.repoName,
      repo_url: entity.repoUrl,
      repo_description: entity.repoDescription,
      language: entity.language,
      stars: entity.stars,
      forks: entity.forks,
      is_analyzed: entity.isAnalyzed,
      analysis_status: entity.analysisStatus,
      analysis_progress: entity.analysisProgress,
      analysis_current_stage: entity.analysisCurrentStage,
      analysis_summary: entity.analysisSummary,
      analysis_detected_skills: entity.analysisDetectedSkills,
      analysis_metadata: entity.analysisMetadata,
      last_analyzed_at: entity.lastAnalyzedAt,
      last_synced: entity.lastSynced,
    };
  }
}
