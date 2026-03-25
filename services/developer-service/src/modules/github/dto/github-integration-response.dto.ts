export class GithubIntegrationResponseDto {
  id: string;
  github_username: string;
  connected_at: Date;

  static fromEntity(entity: any): GithubIntegrationResponseDto {
    return {
      id: entity.id,
      github_username: entity.githubUsername,
      connected_at: entity.connectedAt,
    };
  }
}
