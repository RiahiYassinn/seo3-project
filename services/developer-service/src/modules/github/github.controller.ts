import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GithubService } from './github.service';
import { LinkGithubDto } from './dto/link-github.dto';
import { AnalyzeRepoDto } from './dto/analyze-repo.dto';
import { GithubIntegrationResponseDto } from './dto/github-integration-response.dto';
import { RepositoryResponseDto } from './dto/repository-response.dto';

@Controller()
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @MessagePattern('github_get_integration')
  async getIntegration(@Payload() data: { userId: string }) {
    const integration = await this.githubService.getIntegration(data.userId);
    return GithubIntegrationResponseDto.fromEntity(integration);
  }

  @MessagePattern('github_link_account')
  async linkGithub(@Payload() data: { userId: string } & LinkGithubDto) {
    const { userId, ...dto } = data;
    const integration = await this.githubService.linkGithub(userId, dto);
    return GithubIntegrationResponseDto.fromEntity(integration);
  }

  @MessagePattern('github_unlink_account')
  unlinkGithub(@Payload() data: { userId: string }) {
    return this.githubService.unlinkGithub(data.userId);
  }

  @MessagePattern('github_get_repositories')
  async getRepositories(@Payload() data: { userId: string }) {
    const repos = await this.githubService.getRepositories(data.userId);
    return repos.map(repo => RepositoryResponseDto.fromEntity(repo));
  }

  @MessagePattern('github_sync_repositories')
  async syncRepositories(@Payload() data: { userId: string }) {
    const repos = await this.githubService.syncRepositories(data.userId);
    return repos.map(repo => RepositoryResponseDto.fromEntity(repo));
  }

  @MessagePattern('github_trigger_analysis')
  triggerAnalysis(@Payload() data: { userId: string; repositoryId: string }) {
    return this.githubService.triggerAnalysis(data.userId, data.repositoryId);
  }
}