// api-gateway/src/github/github.service.ts
import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { LinkGitHubDto } from './dto/link-github.dto';
import { SyncRepositoriesDto } from './dto/sync-repos.dto';
import { AnalyzeRepositoryDto } from './dto/analyze-repo.dto';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  constructor(
    @Inject('DEVELOPER_SERVICE') private developerClient: ClientProxy,
  ) {}

  async getIntegration(userId: string) {
    this.logger.log(`Getting integration for user: ${userId}`);
    try {
      const result = await firstValueFrom(
        this.developerClient.send('get_github_integration', { userId })
      );
      return result;
    } catch (error) {
      this.logger.error(`Error getting integration: ${error.message}`);
      if (error?.message?.includes('not found')) {
        throw new NotFoundException('GitHub integration not found');
      }
      throw error;
    }
  }

  async linkGitHub(userId: string, linkDto: LinkGitHubDto) {
    this.logger.log(`Linking GitHub for user: ${userId}`);
    try {
      const result = await firstValueFrom(
        this.developerClient.send('link_github', { 
          userId, 
          github_username: linkDto.github_username,
          github_token: linkDto.github_token
        })
      );
      return result;
    } catch (error) {
      this.logger.error(`Error linking GitHub: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to link GitHub account');
    }
  }

  async unlinkGitHub(userId: string) {
    this.logger.log(`Unlinking GitHub for user: ${userId}`);
    try {
      const result = await firstValueFrom(
        this.developerClient.send('unlink_github', { userId })
      );
      return result;
    } catch (error) {
      this.logger.error(`Error unlinking GitHub: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to unlink GitHub account');
    }
  }

  async getRepositories(userId: string) {
    this.logger.log(`Getting repositories for user: ${userId}`);
    try {
      const result = await firstValueFrom(
        this.developerClient.send('get_repositories', { userId })
      );
      return result || [];
    } catch (error) {
      this.logger.error(`Error getting repositories: ${error.message}`);
      return [];
    }
  }

  async syncRepositories(userId: string, syncDto: SyncRepositoriesDto) {
    this.logger.log(`Syncing repositories for user: ${userId}`);
    try {
      // First verify the integration belongs to this user
      await this.getIntegration(userId);
      
      const result = await firstValueFrom(
        this.developerClient.send('sync_repositories', { 
          integrationId: syncDto.integrationId,
          username: syncDto.username,
        })
      );
      return result;
    } catch (error) {
      this.logger.error(`Error syncing repositories: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to sync repositories');
    }
  }

  async analyzeRepository(userId: string, analyzeDto: AnalyzeRepositoryDto) {
    // This will be implemented in the analysis service later
    this.logger.log(`Analysis requested for repository: ${analyzeDto.repository_id}`);
    return { 
      message: 'Analysis will be implemented in the next phase',
      repositoryId: analyzeDto.repository_id 
    };
  }
}