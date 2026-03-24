import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GitHubService } from './github.service';

@Controller()
export class GitHubController {
  constructor(private readonly gitHubService: GitHubService) {}

  @MessagePattern('get_github_integration' )
  async getIntegration(@Payload() data: { userId: string }) {
    return this.gitHubService.getIntegration(data.userId);
  }

  @MessagePattern('link_github' )
  async linkGitHub(@Payload() data: { userId: string; github_username: string; github_token: string }) {
    return this.gitHubService.linkGitHub(data.userId, data.github_username, data.github_token);
  }

  @MessagePattern('unlink_github' )
  async unlinkGitHub(@Payload() data: { userId: string }) {
    return this.gitHubService.unlinkGitHub(data.userId);
  }

  @MessagePattern('get_repositories' )
  async getRepositories(@Payload() data: { userId: string }) {
    return this.gitHubService.getRepositories(data.userId);
  }

  @MessagePattern('sync_repositories' )
  async syncRepositories(@Payload() data: { integrationId: string; username: string; token?: string }) {
    return this.gitHubService.syncRepositories(data.integrationId, data.username, data.token);
  }

  @MessagePattern('update_repository_status')
  async updateRepositoryStatus(@Payload() data: { repositoryId: string; status: string; isAnalyzed: boolean }) {
    return this.gitHubService.updateRepositoryAnalysisStatus(data.repositoryId, data.status, data.isAnalyzed);
  }
}