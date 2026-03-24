import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { Octokit } from '@octokit/rest';
import * as crypto from 'crypto';

import { GithubIntegration } from './entities/github-integration.entity';
import { Repository } from './entities/repository.entity';
import { LinkGithubDto } from './dto/link-github.dto';
import { AnalysisRequestedEvent } from './events/analysis-requested.event';

@Injectable()
export class GithubService {
  // Use a real secrets manager (AWS KMS, Vault) in production
  private readonly encryptionKey = Buffer.from(
    process.env.TOKEN_ENCRYPTION_KEY!, // 32-byte hex key
    'hex',
  );

  constructor(
    @InjectRepository(GithubIntegration)
    private readonly integrationRepo: TypeOrmRepository<GithubIntegration>,

    @InjectRepository(Repository)
    private readonly repositoryRepo: TypeOrmRepository<Repository>,

    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  // ─── Token encryption helpers ───────────────────────────────────────────────

  private encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(ciphertext: string): string {
    const [ivHex, encryptedHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  // ─── Octokit factory ────────────────────────────────────────────────────────

  private getOctokit(integration: GithubIntegration & { githubTokenEncrypted: string }) {
    const token = this.decrypt(integration.githubTokenEncrypted);
    return new Octokit({ auth: token });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async getIntegration(developerId: string): Promise<GithubIntegration> {
    const integration = await this.integrationRepo.findOne({
      where: { developerId },
    });
    if (!integration) throw new NotFoundException('No GitHub integration found');
    return integration;
  }

  async linkGithub(developerId: string, dto: LinkGithubDto): Promise<GithubIntegration> {
    // Prevent duplicate integrations
    const existing = await this.integrationRepo.findOne({ where: { developerId } });
    if (existing) throw new ConflictException('GitHub account already linked');

    // Validate token against GitHub API before storing
    const octokit = new Octokit({ auth: dto.github_token });
    try {
      const { data: ghUser } = await octokit.users.getAuthenticated();
      // Ensure the username matches the authenticated GitHub user
      if (ghUser.login.toLowerCase() !== dto.github_username.toLowerCase()) {
        throw new UnauthorizedException(
          'Token does not belong to the provided GitHub username',
        );
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid GitHub token');
    }

    const integration = this.integrationRepo.create({
      developerId,
      githubUsername: dto.github_username,
      githubTokenEncrypted: this.encrypt(dto.github_token),
      connectedAt: new Date(),
    });

    return this.integrationRepo.save(integration);
  }

  async unlinkGithub(developerId: string): Promise<void> {
    const integration = await this.getIntegration(developerId);
    // Cascade delete removes all repositories too
    await this.integrationRepo.remove(integration);
  }

  async syncRepositories(developerId: string): Promise<Repository[]> {
    const integration = await this.integrationRepo.findOne({
      where: { developerId },
      select: ['id', 'developerId', 'githubUsername', 'githubTokenEncrypted', 'connectedAt'],
    }) as GithubIntegration & { githubTokenEncrypted: string };

    if (!integration) throw new NotFoundException('No GitHub integration found');

    const octokit = this.getOctokit(integration);

    // Fetch all repos (handles pagination automatically)
    const ghRepos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
      per_page: 100,
      sort: 'updated',
      type: 'owner', // Only repos the user owns (not forks unless needed)
    });

    const now = new Date();

    // Upsert each repo — preserve existing analysis status
    const upsertPromises = ghRepos.map(async (ghRepo) => {
      const existing = await this.repositoryRepo.findOne({
        where: { integrationId: integration.id, githubRepoId: ghRepo.id },
      });

      if (existing) {
        // Update metadata but keep analysis state
        existing.repoName = ghRepo.name;
        existing.repoUrl = ghRepo.html_url;
        existing.repoDescription = ghRepo.description ?? null;
        existing.language = ghRepo.language ?? null;
        existing.stars = ghRepo.stargazers_count ?? 0;
        existing.forks = ghRepo.forks_count ?? 0;
        existing.lastSynced = now;
        return this.repositoryRepo.save(existing);
      }

      const newRepo = this.repositoryRepo.create({
        integrationId: integration.id,
        githubRepoId: ghRepo.id,
        repoName: ghRepo.name,
        repoUrl: ghRepo.html_url,
        repoDescription: ghRepo.description ?? null,
        language: ghRepo.language ?? null,
        stars: ghRepo.stargazers_count ?? 0,
        forks: ghRepo.forks_count ?? 0,
        isAnalyzed: false,
        analysisStatus: null,
        lastSynced: now,
      });
      return this.repositoryRepo.save(newRepo);
    });

    return Promise.all(upsertPromises);
  }

  async getRepositories(developerId: string): Promise<Repository[]> {
    const integration = await this.integrationRepo.findOne({
      where: { developerId },
    });
    if (!integration) return [];

    return this.repositoryRepo.find({
      where: { integrationId: integration.id },
      order: { lastSynced: 'DESC' },
    });
  }

  async triggerAnalysis(developerId: string, repositoryId: string): Promise<void> {
    const integration = await this.integrationRepo.findOne({
      where: { developerId },
    });
    if (!integration) throw new NotFoundException('No GitHub integration found');

    const repo = await this.repositoryRepo.findOne({
      where: { id: repositoryId, integrationId: integration.id },
    });
    if (!repo) throw new NotFoundException('Repository not found');

    // Mark as pending immediately
    repo.analysisStatus = 'pending';
    await this.repositoryRepo.save(repo);

    // Emit Kafka event — Analysis Service will pick this up
    const event = new AnalysisRequestedEvent(
      repo.id,
      integration.id,
      developerId,
      repo.repoName,
      repo.repoUrl,
      integration.githubUsername,
    );

    this.kafkaClient.emit(event.topic, {
      key: repositoryId,
      value: JSON.stringify(event),
    });
  }
}