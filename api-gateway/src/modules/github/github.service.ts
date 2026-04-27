import { Injectable, Inject, NotFoundException, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GithubService {
  constructor(
    @Inject('DEVELOPER_SERVICE') private developerService: ClientProxy,
  ) {}

  private handleError(error: any) {
    // RpcException errors come with error.error property containing the actual error data
    const errorData = error?.error || error;
    const message = errorData?.message || errorData || 'An error occurred';
    const statusCode = errorData?.statusCode || error?.status || 500;

    // Map status codes to appropriate exceptions
    if (statusCode === 404) {
      throw new NotFoundException(message);
    }
    if (statusCode === 409) {
      throw new ConflictException(message);
    }
    if (statusCode === 401) {
      throw new UnauthorizedException(message);
    }

    throw new BadRequestException(message);
  }

  async getIntegration(userId: string) {
    try {
      return await firstValueFrom(
        this.developerService.send('github_get_integration', { userId }),
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async linkGithub(userId: string, data: any) {
    try {
      return await firstValueFrom(
        this.developerService.send('github_link_account', { userId, ...data }),
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async unlinkGithub(userId: string) {
    try {
      return await firstValueFrom(
        this.developerService.send('github_unlink_account', { userId }),
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async getRepositories(userId: string) {
    try {
      return await firstValueFrom(
        this.developerService.send('github_get_repositories', { userId }),
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async getRepository(userId: string, repositoryId: string) {
    try {
      return await firstValueFrom(
        this.developerService.send('github_get_repository', { userId, repositoryId }),
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async syncRepositories(userId: string) {
    try {
      return await firstValueFrom(
        this.developerService.send('github_sync_repositories', { userId }),
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async triggerAnalysis(userId: string, repositoryId: string) {
    try {
      return await firstValueFrom(
        this.developerService.send('github_trigger_analysis', { userId, repositoryId }),
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async getRepositoryContributors(userId: string, repositoryId: string) {
    try {
      return await firstValueFrom(
        this.developerService.send('github_get_repository_contributors', {
          userId,
          repositoryId,
        }),
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async getRepositoryContributorProfiles(userId: string, repositoryId: string) {
    try {
      return await firstValueFrom(
        this.developerService.send('github_get_repository_contributor_profiles', {
          userId,
          repositoryId,
        }),
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async triggerContributorAnalysis(
    userId: string,
    repositoryId: string,
    contributorLogins: string[],
  ) {
    try {
      return await firstValueFrom(
        this.developerService.send('github_trigger_contributor_analysis', {
          userId,
          repositoryId,
          contributorLogins,
        }),
      );
    } catch (error) {
      this.handleError(error);
    }
  }
}
