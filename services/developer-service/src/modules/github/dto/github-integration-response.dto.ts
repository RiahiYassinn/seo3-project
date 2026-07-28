export class GithubIntegrationResponseDto {
  id: string;
  developer_id: string;
  github_username: string;
  connected_at: Date;

  static fromEntity(entity: any): GithubIntegrationResponseDto {
    return {
      id: entity.id,
      developer_id: entity.developerId,
      github_username: entity.githubUsername,
      connected_at: entity.connectedAt,
    };
  }
}
