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
      last_analyzed_at: entity.lastAnalyzedAt,
      last_synced: entity.lastSynced,
    };
  }
}
