import {
  Injectable,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Octokit } from '@octokit/rest';
import { LinkGitHubDto } from './dto/link-github.dto';
import { SyncReposDto } from './dto/sync-repos.dto';

@Injectable()
export class GitHubService {
  constructor(
    @Inject('DEVELOPER_SERVICE') private developerClient: ClientProxy,
  ) {}

  async getIntegration(developerId: string) {
    try {
      const result = await firstValueFrom(
        this.developerClient.send('get_github_integration', { developerId }),
      );
      return result;
    } catch (error) {
      if (error?.status === 404) {
        throw new HttpException('No GitHub integration found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        error?.message || 'Failed to get GitHub integration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async linkGitHub(developerId: string, linkGitHubDto: LinkGitHubDto) {
    try {
      // Verify GitHub token by fetching user info
      const octokit = new Octokit({ auth: linkGitHubDto.github_token });

      let githubUser;
      try {
        const { data } = await octokit.users.getAuthenticated();
        githubUser = data;

        // Verify the username matches
        if (githubUser.login !== linkGitHubDto.github_username) {
          throw new HttpException(
            'GitHub username does not match the authenticated user',
            HttpStatus.BAD_REQUEST,
          );
        }
      } catch (error) {
        throw new HttpException(
          'Invalid GitHub token or unable to verify credentials',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Store integration in developer service
      const result = await firstValueFrom(
        this.developerClient.send('link_github', {
          developerId,
          github_username: linkGitHubDto.github_username,
          github_token: linkGitHubDto.github_token,
          github_id: githubUser.id,
          avatar_url: githubUser.avatar_url,
        }),
      );

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to link GitHub account',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async unlinkGitHub(developerId: string) {
    try {
      const result = await firstValueFrom(
        this.developerClient.send('unlink_github', { developerId }),
      );
      return result;
    } catch (error) {
      if (error?.status === 404) {
        throw new HttpException('No GitHub integration found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        error?.message || 'Failed to unlink GitHub account',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getRepositories(developerId: string) {
    try {
      const result = await firstValueFrom(
        this.developerClient.send('get_github_repositories', { developerId }),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        error?.message || 'Failed to get repositories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async syncRepositories(developerId: string, syncReposDto: SyncReposDto) {
    try {
      // Get integration to fetch the token
      const integration = await firstValueFrom(
        this.developerClient.send('get_github_integration', { developerId }),
      );

      if (!integration) {
        throw new HttpException('No GitHub integration found', HttpStatus.NOT_FOUND);
      }

      // Fetch repositories from GitHub API
      const octokit = new Octokit({ auth: integration.github_token });

      const { data: repos } = await octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
      });

      // Send repositories to developer service to store
      const result = await firstValueFrom(
        this.developerClient.send('sync_github_repositories', {
          developerId,
          integrationId: syncReposDto.integrationId,
          repositories: repos.map((repo) => ({
            github_repo_id: repo.id,
            repo_name: repo.full_name,
            repo_url: repo.html_url,
            repo_description: repo.description || '',
            language: repo.language || 'Unknown',
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            is_private: repo.private,
            default_branch: repo.default_branch,
          })),
        }),
      );

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to sync repositories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async analyzeRepository(developerId: string, repositoryId: string) {
    try {
      // Get repository details
      const repository = await firstValueFrom(
        this.developerClient.send('get_repository_by_id', {
          developerId,
          repositoryId,
        }),
      );

      if (!repository) {
        throw new HttpException('Repository not found', HttpStatus.NOT_FOUND);
      }

      // Get integration for token
      const integration = await firstValueFrom(
        this.developerClient.send('get_github_integration', { developerId }),
      );

      // Trigger NLP analysis (this would send to Kafka or NLP service)
      const result = await firstValueFrom(
        this.developerClient.send('analyze_repository', {
          developerId,
          repositoryId,
          repoName: repository.repo_name,
          repoUrl: repository.repo_url,
          githubToken: integration.github_token,
        }),
      );

      return {
        message: 'Repository analysis started',
        analysisId: result.analysisId,
        repository: repository.repo_name,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to start repository analysis',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
