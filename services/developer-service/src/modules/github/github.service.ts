import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { GitHubIntegration } from './entities/github-integration.entity';
import { Repository } from './entities/repository.entity';
import { Octokit } from '@octokit/rest';

@Injectable()
export class GitHubService {
  constructor(
    @InjectRepository(GitHubIntegration)
    private integrationRepository: TypeOrmRepository<GitHubIntegration>,
    @InjectRepository(Repository)
    private repositoryRepository: TypeOrmRepository<Repository>,
  ) {}

  async getIntegration(userId: string): Promise<GitHubIntegration> {
    const integration = await this.integrationRepository.findOne({
      where: { userId },
    });
    
    if (!integration) {
      throw new NotFoundException('GitHub integration not found');
    }
    
    return integration;
  }

  async linkGitHub(userId: string, githubUsername: string, githubToken: string): Promise<GitHubIntegration> {
    // Validate token with GitHub
    await this.validateGitHubToken(githubToken, githubUsername);
    
    // Check if integration already exists
    let integration = await this.integrationRepository.findOne({
      where: { userId },
    });
    
    if (integration) {
      // Update existing integration
      integration.github_username = githubUsername;
      integration.github_token = githubToken;
      integration.connected_at = new Date();
    } else {
      // Create new integration
      integration = this.integrationRepository.create({
        userId,
        github_username: githubUsername,
        github_token: githubToken,
        connected_at: new Date(),
      });
    }
    
    await this.integrationRepository.save(integration);
    
    // Sync repositories immediately after linking
    await this.syncRepositories(integration.id, githubUsername, githubToken);
    
    return integration;
  }

  async unlinkGitHub(userId: string): Promise<void> {
    const integration = await this.integrationRepository.findOne({
      where: { userId },
    });
    
    if (!integration) {
      throw new NotFoundException('GitHub integration not found');
    }
    
    // Delete all repositories first
    await this.repositoryRepository.delete({ integrationId: integration.id });
    // Delete integration
    await this.integrationRepository.delete({ id: integration.id });
  }

  async getRepositories(userId: string): Promise<Repository[]> {
    const integration = await this.integrationRepository.findOne({
      where: { userId },
    });
    
    if (!integration) {
      return [];
    }
    
    return this.repositoryRepository.find({
      where: { integrationId: integration.id },
      order: { last_synced: 'DESC' },
    });
  }

  async syncRepositories(integrationId: string, username: string, token?: string): Promise<void> {
    let integration: GitHubIntegration;
    let githubToken: string;
    
    if (token) {
      githubToken = token;
    } else {
      integration = await this.integrationRepository.findOne({
        where: { id: integrationId },
      });
      
      if (!integration) {
        throw new NotFoundException('Integration not found');
      }
      githubToken = integration.github_token;
    }
    
    const octokit = new Octokit({ auth: githubToken });
    
    try {
      // Fetch user repositories
      const { data: repos } = await octokit.repos.listForUser({
        username,
        sort: 'updated',
        per_page: 100,
      });
      
      // Process each repository
      for (const repo of repos) {
        let repository = await this.repositoryRepository.findOne({
          where: { 
            repo_id: repo.id.toString(), 
            integrationId 
          },
        });
        
        if (repository) {
          // Update existing repository
          repository.repo_name = repo.full_name;
          repository.repo_url = repo.html_url;
          repository.repo_description = repo.description || '';
          repository.language = repo.language || '';
          repository.stars = repo.stargazers_count;
          repository.forks = repo.forks_count;
          repository.last_synced = new Date();
        } else {
          // Create new repository
          repository = this.repositoryRepository.create({
            integrationId,
            repo_id: repo.id.toString(),
            repo_name: repo.full_name,
            repo_url: repo.html_url,
            repo_description: repo.description || '',
            language: repo.language || '',
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            is_analyzed: false,
            last_synced: new Date(),
          });
        }
        
        await this.repositoryRepository.save(repository);
      }
    } catch (error) {
      console.error('Error syncing repositories:', error);
      throw new BadRequestException('Failed to sync repositories: ' + error.message);
    }
  }

  async updateRepositoryAnalysisStatus(repositoryId: string, status: string, isAnalyzed: boolean): Promise<void> {
    const repository = await this.repositoryRepository.findOne({
      where: { id: repositoryId },
    });
    
    if (repository) {
      repository.analysis_status = status;
      repository.is_analyzed = isAnalyzed;
      if (isAnalyzed) {
        repository.last_analyzed_at = new Date();
      }
      await this.repositoryRepository.save(repository);
    }
  }

  private async validateGitHubToken(token: string, username: string): Promise<void> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'SEO3-Platform',
        },
      });
      
      if (!response.ok) {
        throw new Error('Invalid GitHub token');
      }
      
      const userData = await response.json();
      if (userData.login !== username) {
        throw new Error('Token username mismatch');
      }
    } catch (error) {
      throw new BadRequestException('Failed to validate GitHub token: ' + error.message);
    }
  }
}