import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository as TypeOrmRepository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { Octokit } from '@octokit/rest';
import * as crypto from 'crypto';

import { GithubIntegration } from './entities/github-integration.entity';
import { Repository } from './entities/repository.entity';
import { AnalysisStatus } from './entities/repository.entity';
import { LinkGithubDto } from './dto/link-github.dto';
import { AnalysisRequestedEvent } from './events/analysis-requested.event';
import { Developer } from '../developer/entities/developer.entity';

interface GithubContributor {
  login: string;
  contributions?: number;
  avatar_url?: string;
  html_url?: string;
  type?: string;
}

export interface ContributorProfileSummary {
  profileId: string;
  contributorLogin: string;
  contributorName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  repositoryId: string;
  repositoryName: string;
  status: AnalysisStatus;
  analyzedAt: string | null;
  qualityScore: number | null;
  skillLevel: string | null;
  strengths: string[];
  weaknessScores: Record<string, number>;
  topWeaknesses: Array<Record<string, any>>;
  recommendations: Array<Record<string, any>>;
  findingsSummary: Record<string, any> | null;
  skills: Array<Record<string, any>>;
  analysisSummary: Record<string, any> | null;
  metadata: Record<string, any>;
}

interface ContributorAnalysisQueueState {
  total: number;
  queue: string[];
  activeContributor: string | null;
  processed: string[];
  failed: string[];
  requestedAt: string;
  requestedBy: string;
}

@Injectable()
export class GithubService {
  private readonly encryptionKey = Buffer.from(
    process.env.TOKEN_ENCRYPTION_KEY!,
    'hex',
  );

  constructor(
    @InjectRepository(GithubIntegration)
    private readonly integrationRepo: TypeOrmRepository<GithubIntegration>,

    @InjectRepository(Repository)
    private readonly repositoryRepo: TypeOrmRepository<Repository>,

    @InjectRepository(Developer)
    private readonly developerRepo: TypeOrmRepository<Developer>,

    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

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

  private getOctokit(
    integration: GithubIntegration & { githubTokenEncrypted: string },
  ) {
    const token = this.decrypt(integration.githubTokenEncrypted);
    return new Octokit({ auth: token });
  }

  private normalizeContributorLogin(login: string) {
    return String(login || '').trim().toLowerCase();
  }

  private buildContributorProfileId(repositoryId: string, contributorLogin: string) {
    return `repo:${repositoryId}:contributor:${this.normalizeContributorLogin(contributorLogin)}`;
  }

  private parseRepositoryUrl(repoUrl: string) {
    const url = new URL(repoUrl);
    const [owner, repo] = url.pathname.replace(/^\/+/, '').split('/');

    return {
      owner,
      repo: repo?.replace(/\.git$/, ''),
    };
  }

  private deriveSkillLevel(summary: Record<string, any> | null): string | null {
    if (!summary) {
      return null;
    }

    if (typeof summary.skill_level === 'string' && summary.skill_level.trim()) {
      return summary.skill_level;
    }

    if (typeof summary.quality_score !== 'number') {
      return null;
    }

    if (summary.quality_score >= 8) {
      return 'advanced';
    }
    if (summary.quality_score >= 5.5) {
      return 'intermediate';
    }
    return 'beginner';
  }

  private deriveTopWeaknesses(summary: Record<string, any> | null) {
    if (!summary) {
      return [];
    }

    if (Array.isArray(summary.top_weaknesses) && summary.top_weaknesses.length > 0) {
      return summary.top_weaknesses;
    }

    if (!summary.weakness_scores || typeof summary.weakness_scores !== 'object') {
      return [];
    }

    return Object.entries(summary.weakness_scores)
      .map(([category, score]) => ({
        category,
        score,
      }))
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
      .slice(0, 3);
  }

  private deriveRecommendations(summary: Record<string, any> | null) {
    if (!summary) {
      return [];
    }

    if (Array.isArray(summary.recommendations) && summary.recommendations.length > 0) {
      return summary.recommendations;
    }

    const learningResources = Array.isArray(summary.learning_resources)
      ? summary.learning_resources
      : [];

    return learningResources.slice(0, 5).map((resource: Record<string, any>) => ({
      weakness: resource.skill || 'general_code_quality',
      action: resource.title ? `Review ${resource.title}` : 'Review recommended resource',
      learning_query: resource.url || '',
      type: resource.type || 'resource',
    }));
  }

  private getContributorProfiles(
    metadata: Record<string, any> | null | undefined,
  ): Record<string, ContributorProfileSummary> {
    if (!metadata?.contributorProfiles || typeof metadata.contributorProfiles !== 'object') {
      return {};
    }

    return metadata.contributorProfiles as Record<string, ContributorProfileSummary>;
  }

  private getContributorAnalysisState(
    metadata: Record<string, any> | null | undefined,
  ): ContributorAnalysisQueueState | null {
    if (!metadata?.contributorAnalysis || typeof metadata.contributorAnalysis !== 'object') {
      return null;
    }

    return metadata.contributorAnalysis as ContributorAnalysisQueueState;
  }

  private setRepositoryMetadata(
    repo: Repository,
    nextValues: Partial<Record<string, any>>,
  ) {
    repo.analysisMetadata = {
      ...(repo.analysisMetadata || {}),
      ...nextValues,
    };
  }

  private computeBatchProgress(
    state: ContributorAnalysisQueueState | null,
    activeProgress = 0,
  ) {
    if (!state || state.total <= 0) {
      return Math.max(0, Math.min(100, activeProgress));
    }

    const completedCount = state.processed.length + state.failed.length;
    const activeFraction = state.activeContributor
      ? Math.max(0, Math.min(100, activeProgress)) / 100
      : 0;

    const rawProgress = Math.round(
      ((completedCount + activeFraction) / state.total) * 100,
    );
    return Math.max(0, Math.min(100, rawProgress));
  }

  private normalizeRepositoryAnalysisState(repo: Repository): boolean {
    let changed = false;

    const clampedProgress = Math.max(0, Math.min(100, repo.analysisProgress || 0));
    if (repo.analysisProgress !== clampedProgress) {
      repo.analysisProgress = clampedProgress;
      changed = true;
    }

    const state = this.getContributorAnalysisState(repo.analysisMetadata);
    if (!state) {
      return changed;
    }

    const settled =
      state.total > 0 &&
      !state.activeContributor &&
      state.queue.length === 0;

    if (!settled) {
      return changed;
    }

    const hasFailures = state.failed.length > 0 && state.processed.length === 0;
    const finalStatus: AnalysisStatus = hasFailures ? 'failed' : 'completed';
    const finalStage = hasFailures
      ? 'Contributor analysis finished with failures'
      : 'Contributor analysis completed';

    if (repo.analysisStatus !== finalStatus) {
      repo.analysisStatus = finalStatus;
      changed = true;
    }

    if (repo.analysisProgress !== 100) {
      repo.analysisProgress = 100;
      changed = true;
    }

    if (!repo.analysisCurrentStage || repo.analysisCurrentStage.includes('in progress')) {
      repo.analysisCurrentStage = finalStage;
      changed = true;
    }

    if (repo.isAnalyzed !== !hasFailures) {
      repo.isAnalyzed = !hasFailures;
      changed = true;
    }

    return changed;
  }

  private async getIntegrationForDeveloper(
    developerId: string,
    includeToken = false,
  ) {
    const integration = await this.integrationRepo.findOne({
      where: { developerId },
      select: includeToken
        ? ['id', 'developerId', 'githubUsername', 'githubTokenEncrypted', 'connectedAt']
        : ['id', 'developerId', 'githubUsername', 'connectedAt'],
    });

    if (!integration) {
      throw new RpcException({
        statusCode: 404,
        message: 'No GitHub integration found',
      });
    }

    return integration as GithubIntegration & { githubTokenEncrypted: string };
  }

  private async getRepositoryForDeveloper(
    developerId: string,
    repositoryId: string,
  ) {
    const integration = await this.integrationRepo.findOne({
      where: { developerId },
    });
    if (!integration) {
      throw new RpcException({
        statusCode: 404,
        message: 'No GitHub integration found',
      });
    }

    const repository = await this.repositoryRepo.findOne({
      where: { id: repositoryId, integrationId: integration.id },
    });
    if (!repository) {
      throw new RpcException({
        statusCode: 404,
        message: 'Repository not found',
      });
    }

    if (this.normalizeRepositoryAnalysisState(repository)) {
      await this.repositoryRepo.save(repository);
    }

    return { integration, repository };
  }

  private async fetchRepositoryContributors(
    integration: GithubIntegration & { githubTokenEncrypted: string },
    repository: Repository,
  ): Promise<GithubContributor[]> {
    const octokit = this.getOctokit(integration);
    const coordinates = this.parseRepositoryUrl(repository.repoUrl);

    return octokit.paginate(octokit.repos.listContributors, {
      owner: coordinates.owner,
      repo: coordinates.repo,
      per_page: 100,
    }) as Promise<GithubContributor[]>;
  }

  private async emitContributorAnalysisRequest(
    repo: Repository,
    integration: GithubIntegration & { githubTokenEncrypted: string },
    contributorLogin: string,
    requestedByUserId: string,
  ) {
    const event = new AnalysisRequestedEvent(
      repo.id,
      integration.id,
      this.buildContributorProfileId(repo.id, contributorLogin),
      repo.repoName,
      repo.repoUrl,
      contributorLogin,
      this.decrypt(integration.githubTokenEncrypted),
      requestedByUserId,
    );

    this.kafkaClient.emit(event.topic, {
      key: repo.id,
      value: JSON.stringify(event),
    });
  }

  private async startNextContributorAnalysis(
    repositoryId: string,
  ): Promise<void> {
    const repo = await this.repositoryRepo.findOne({
      where: { id: repositoryId },
    });
    if (!repo) {
      return;
    }

    const state = this.getContributorAnalysisState(repo.analysisMetadata);
    if (!state) {
      return;
    }

    if (state.activeContributor) {
      return;
    }

    const nextContributor = state.queue.shift() || null;
    if (!nextContributor) {
      const hasFailures = state.failed.length > 0 && state.processed.length === 0;
      repo.analysisStatus = hasFailures ? 'failed' : 'completed';
      repo.analysisProgress = 100;
      repo.analysisCurrentStage = hasFailures
        ? 'Contributor analysis finished with failures'
        : 'Contributor analysis completed';
      this.setRepositoryMetadata(repo, {
        contributorAnalysis: state,
      });
      await this.repositoryRepo.save(repo);
      return;
    }

    const integration = await this.integrationRepo.findOne({
      where: { id: repo.integrationId },
      select: ['id', 'developerId', 'githubUsername', 'githubTokenEncrypted', 'connectedAt'],
    }) as GithubIntegration & { githubTokenEncrypted: string };

    if (!integration) {
      throw new RpcException({
        statusCode: 404,
        message: 'GitHub integration not found for repository',
      });
    }

    state.activeContributor = nextContributor;
    repo.analysisStatus = 'pending';
    repo.analysisProgress = this.computeBatchProgress(state, 5);
    repo.analysisCurrentStage = `Queued analysis for @${nextContributor}`;
    this.setRepositoryMetadata(repo, {
      contributorAnalysis: state,
    });
    await this.repositoryRepo.save(repo);

    await this.emitContributorAnalysisRequest(
      repo,
      integration,
      nextContributor,
      state.requestedBy,
    );
  }

  async getIntegration(developerId: string): Promise<GithubIntegration> {
    return this.getIntegrationForDeveloper(developerId);
  }

  async findIntegrationByGithubUsername(githubUsername: string): Promise<GithubIntegration | null> {
    const normalizedUsername = this.normalizeContributorLogin(githubUsername);
    if (!normalizedUsername) {
      return null;
    }

    const integrations = await this.integrationRepo.find({
      select: ['id', 'developerId', 'githubUsername', 'connectedAt'],
    });

    const matches = integrations.filter(
      (integration) =>
        this.normalizeContributorLogin(integration.githubUsername) ===
        normalizedUsername,
    );

    if (matches.length <= 1) {
      return matches[0] || null;
    }

    const developers = await this.developerRepo.find({
      where: {
        id: In(matches.map((integration) => integration.developerId)),
      },
    });
    const developerById = new Map(
      developers.map((developer) => [developer.id, developer]),
    );

    matches.sort((left, right) => {
      const leftUser = developerById.get(left.developerId);
      const rightUser = developerById.get(right.developerId);
      const leftScore = this.githubRecipientScore(leftUser);
      const rightScore = this.githubRecipientScore(rightUser);

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return left.connectedAt.getTime() - right.connectedAt.getTime();
    });

    return matches[0];
  }

  private githubRecipientScore(developer?: Developer) {
    if (!developer) {
      return 0;
    }

    let score = developer.isActive ? 10 : 0;

    if (developer.role === 'developer') {
      score += 100;
    } else if (developer.role === 'tech_lead') {
      score += 50;
    }

    return score;
  }

  async linkGithub(developerId: string, dto: LinkGithubDto): Promise<GithubIntegration> {
    const existing = await this.integrationRepo.findOne({ where: { developerId } });
    if (existing) {
      throw new RpcException({
        statusCode: 409,
        message: 'GitHub account already linked',
      });
    }

    const octokit = new Octokit({ auth: dto.github_token });
    try {
      const { data: ghUser } = await octokit.users.getAuthenticated();
      if (ghUser.login.toLowerCase() !== dto.github_username.toLowerCase()) {
        throw new RpcException({
          statusCode: 400,
          message: 'Token does not belong to the provided GitHub username',
        });
      }
    } catch (err) {
      if (err instanceof RpcException) throw err;
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid GitHub token',
      });
    }

    const integration = this.integrationRepo.create({
      developerId,
      githubUsername: dto.github_username,
      githubTokenEncrypted: this.encrypt(dto.github_token),
      connectedAt: new Date(),
    });

    return this.integrationRepo.save(integration);
  }

  async unlinkGithub(developerId: string): Promise<{ success: true }> {
    const integration = await this.integrationRepo.findOne({
      where: { developerId },
    });
    if (!integration) {
      throw new RpcException({
        statusCode: 404,
        message: 'No GitHub integration found',
      });
    }

    await this.integrationRepo.remove(integration);
    return { success: true };
  }

  async syncRepositories(developerId: string): Promise<Repository[]> {
    const integration = await this.getIntegrationForDeveloper(developerId, true);
    const octokit = this.getOctokit(integration);

    const ghRepos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
      per_page: 100,
      sort: 'updated',
      affiliation: 'owner,organization_member',
    });

    const now = new Date();
    const upsertPromises = ghRepos.map(async (ghRepo) => {
      const existing = await this.repositoryRepo.findOne({
        where: { integrationId: integration.id, githubRepoId: ghRepo.id },
      });

      if (existing) {
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

    const repositories = await this.repositoryRepo.find({
      where: { integrationId: integration.id },
      order: { lastSynced: 'DESC' },
    });

    const dirtyRepositories = repositories.filter((repo) =>
      this.normalizeRepositoryAnalysisState(repo),
    );
    if (dirtyRepositories.length > 0) {
      await Promise.all(dirtyRepositories.map((repo) => this.repositoryRepo.save(repo)));
    }

    return repositories;
  }

  async getRepository(developerId: string, repositoryId: string): Promise<Repository> {
    const { repository } = await this.getRepositoryForDeveloper(developerId, repositoryId);
    return repository;
  }

  async getRepositoryContributors(developerId: string, repositoryId: string) {
    const { repository } = await this.getRepositoryForDeveloper(developerId, repositoryId);
    const integration = await this.getIntegrationForDeveloper(developerId, true);
    const contributors = await this.fetchRepositoryContributors(integration, repository);
    const profileMap = this.getContributorProfiles(repository.analysisMetadata);
    const queueState = this.getContributorAnalysisState(repository.analysisMetadata);

    return contributors
      .map((contributor) => {
        const key = this.normalizeContributorLogin(contributor.login);
        const profile = profileMap[key] || null;
        const status =
          queueState?.activeContributor === key
            ? 'in_progress'
            : queueState?.queue.includes(key)
              ? 'pending'
              : profile?.status || null;

        return {
          login: key,
          display_name: contributor.login,
          contributions: contributor.contributions || 0,
          avatar_url: contributor.avatar_url || null,
          profile_url: contributor.html_url || null,
          type: contributor.type || 'User',
          analysis_status: status,
          profile_id: profile?.profileId || this.buildContributorProfileId(repository.id, key),
          last_analyzed_at: profile?.analyzedAt || null,
          quality_score: profile?.qualityScore ?? null,
          skill_level: profile?.skillLevel ?? null,
          top_weaknesses: profile?.topWeaknesses || [],
          recommendations: profile?.recommendations || [],
        };
      })
      .sort((left, right) => right.contributions - left.contributions);
  }

  async getRepositoryContributorProfiles(developerId: string, repositoryId: string) {
    const { repository } = await this.getRepositoryForDeveloper(developerId, repositoryId);
    const profiles = Object.values(this.getContributorProfiles(repository.analysisMetadata));

    return profiles.sort((left, right) => {
      const leftTime = left.analyzedAt ? new Date(left.analyzedAt).getTime() : 0;
      const rightTime = right.analyzedAt ? new Date(right.analyzedAt).getTime() : 0;
      return rightTime - leftTime;
    });
  }

  async triggerAnalysis(
    developerId: string,
    repositoryId: string,
  ): Promise<{ success: true; status: 'pending'; repositoryId: string; queuedContributors: string[] }> {
    const integration = await this.getIntegrationForDeveloper(developerId);
    return this.triggerContributorAnalysis(developerId, repositoryId, [
      integration.githubUsername,
    ]);
  }

  async triggerContributorAnalysis(
    developerId: string,
    repositoryId: string,
    contributorLogins: string[],
  ): Promise<{ success: true; status: 'pending'; repositoryId: string; queuedContributors: string[] }> {
    const integration = await this.getIntegrationForDeveloper(developerId, true);
    const { repository } = await this.getRepositoryForDeveloper(developerId, repositoryId);

    const queueState = this.getContributorAnalysisState(repository.analysisMetadata);
    if (queueState?.activeContributor || queueState?.queue?.length) {
      throw new RpcException({
        statusCode: 409,
        message: 'A contributor analysis batch is already running for this repository',
      });
    }

    const requested = Array.from(
      new Set(contributorLogins.map((login) => this.normalizeContributorLogin(login)).filter(Boolean)),
    );
    if (requested.length === 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'Select at least one contributor to analyze',
      });
    }

    const githubContributors = await this.fetchRepositoryContributors(integration, repository);
    const availableLogins = new Set(
      githubContributors.map((contributor) => this.normalizeContributorLogin(contributor.login)),
    );
    const validContributors = requested.filter((login) => availableLogins.has(login));

    if (validContributors.length === 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'None of the selected contributors belong to this repository',
      });
    }

    const nextState: ContributorAnalysisQueueState = {
      total: validContributors.length,
      queue: [...validContributors],
      activeContributor: null,
      processed: [],
      failed: [],
      requestedAt: new Date().toISOString(),
      requestedBy: developerId,
    };

    repository.analysisStatus = 'pending';
    repository.analysisProgress = 0;
    repository.analysisCurrentStage =
      validContributors.length === 1
        ? `Queued analysis for @${validContributors[0]}`
        : `Queued analysis for ${validContributors.length} contributors`;
    this.setRepositoryMetadata(repository, {
      contributorAnalysis: nextState,
      lastBatchRequestedAt: nextState.requestedAt,
    });
    await this.repositoryRepo.save(repository);

    await this.startNextContributorAnalysis(repository.id);

    return {
      success: true,
      status: 'pending',
      repositoryId,
      queuedContributors: validContributors,
    };
  }

  async handleContributorProgress(message: {
    repositoryId: string;
    githubUsername?: string;
    progress?: number;
    stage?: string | null;
  }) {
    const repo = await this.repositoryRepo.findOne({
      where: { id: message.repositoryId },
    });
    if (!repo) {
      return;
    }

    const state = this.getContributorAnalysisState(repo.analysisMetadata);
    if (!state) {
      if (repo.analysisStatus === 'completed' || repo.analysisStatus === 'failed') {
        return;
      }

      await this.updateRepositoryAnalysis(message.repositoryId, {
        status: 'in_progress',
        progress: message.progress ?? 0,
        stage: message.stage || 'Analysis in progress',
      });
      return;
    }

    const settled =
      state.total > 0 &&
      !state.activeContributor &&
      state.queue.length === 0 &&
      state.processed.length + state.failed.length >= state.total;
    if (settled) {
      return;
    }

    const contributorLogin = this.normalizeContributorLogin(message.githubUsername || state.activeContributor || '');
    if (!contributorLogin && !state.activeContributor) {
      return;
    }

    const alreadyFinishedContributor = contributorLogin
      ? state.processed.includes(contributorLogin) || state.failed.includes(contributorLogin)
      : false;

    if (alreadyFinishedContributor && state.activeContributor !== contributorLogin) {
      return;
    }

    if (!state.activeContributor && contributorLogin && !alreadyFinishedContributor) {
      state.activeContributor = contributorLogin;
    }

    repo.analysisStatus = 'in_progress';
    repo.analysisProgress = this.computeBatchProgress(state, message.progress ?? 0);
    repo.analysisCurrentStage = contributorLogin
      ? `@${contributorLogin}: ${message.stage || 'Analysis in progress'}`
      : message.stage || 'Analysis in progress';
    this.setRepositoryMetadata(repo, {
      contributorAnalysis: state,
    });
    await this.repositoryRepo.save(repo);
  }

  async handleContributorCompleted(message: {
    repositoryId: string;
    developerId: string;
    repoName?: string;
    githubUsername?: string;
    summary?: Record<string, any>;
    metadata?: Record<string, any>;
    analyzedAt?: string;
  }) {
    const repo = await this.repositoryRepo.findOne({
      where: { id: message.repositoryId },
    });
    if (!repo) {
      return;
    }

    const contributorLogin = this.normalizeContributorLogin(message.githubUsername || '');
    const profiles = this.getContributorProfiles(repo.analysisMetadata);
    const state = this.getContributorAnalysisState(repo.analysisMetadata);
    const summary = (message.summary || null) as Record<string, any> | null;
    const metadata = (message.metadata || {}) as Record<string, any>;
    const topWeaknesses = this.deriveTopWeaknesses(summary);
    const recommendations = this.deriveRecommendations(summary);

    if (contributorLogin) {
      profiles[contributorLogin] = {
        profileId: message.developerId,
        contributorLogin,
        contributorName: contributorLogin,
        avatarUrl: (profiles[contributorLogin]?.avatarUrl as string | null) || null,
        profileUrl: (profiles[contributorLogin]?.profileUrl as string | null) || null,
        repositoryId: repo.id,
        repositoryName: repo.repoName,
        status: 'completed',
        analyzedAt: message.analyzedAt || new Date().toISOString(),
        qualityScore:
          typeof summary?.quality_score === 'number' ? summary.quality_score : null,
        skillLevel: this.deriveSkillLevel(summary),
        strengths: Array.isArray(summary?.strengths) ? summary.strengths : [],
        weaknessScores:
          summary?.weakness_scores && typeof summary.weakness_scores === 'object'
            ? summary.weakness_scores
            : {},
        topWeaknesses,
        recommendations,
        findingsSummary:
          summary?.summary && typeof summary.summary === 'object'
            ? summary.summary
            : null,
        skills: Array.isArray(summary?.skills) ? summary.skills : [],
        analysisSummary: summary,
        metadata,
      };
    }

    if (state) {
      if (contributorLogin && !state.processed.includes(contributorLogin)) {
        state.processed.push(contributorLogin);
      }
      state.activeContributor = null;
    }

    repo.analysisStatus = state?.queue.length ? 'in_progress' : 'completed';
    repo.isAnalyzed = true;
    repo.analysisProgress = this.computeBatchProgress(state, 100);
    repo.analysisCurrentStage = contributorLogin
      ? `Completed analysis for @${contributorLogin}`
      : 'Weakness analysis completed';
    repo.analysisSummary = summary;
    repo.analysisDetectedSkills = Array.isArray(summary?.skills)
      ? (summary.skills as Record<string, any>[])
      : null;
    repo.lastAnalyzedAt = new Date(message.analyzedAt || new Date().toISOString());
    this.setRepositoryMetadata(repo, {
      ...metadata,
      contributorProfiles: profiles,
      contributorAnalysis: state,
    });
    await this.repositoryRepo.save(repo);

    await this.startNextContributorAnalysis(repo.id);
  }

  async handleContributorFailed(message: {
    repositoryId: string;
    githubUsername?: string;
    reason?: string;
    progress?: number;
    stage?: string | null;
  }) {
    const repo = await this.repositoryRepo.findOne({
      where: { id: message.repositoryId },
    });
    if (!repo) {
      return;
    }

    const contributorLogin = this.normalizeContributorLogin(message.githubUsername || '');
    const profiles = this.getContributorProfiles(repo.analysisMetadata);
    const state = this.getContributorAnalysisState(repo.analysisMetadata);

    if (contributorLogin) {
      const existing = profiles[contributorLogin];
      profiles[contributorLogin] = {
        profileId: existing?.profileId || this.buildContributorProfileId(repo.id, contributorLogin),
        contributorLogin,
        contributorName: contributorLogin,
        avatarUrl: existing?.avatarUrl || null,
        profileUrl: existing?.profileUrl || null,
        repositoryId: repo.id,
        repositoryName: repo.repoName,
        status: 'failed',
        analyzedAt: existing?.analyzedAt || null,
        qualityScore: existing?.qualityScore ?? null,
        skillLevel: existing?.skillLevel ?? null,
        strengths: existing?.strengths || [],
        weaknessScores: existing?.weaknessScores || {},
        topWeaknesses: existing?.topWeaknesses || [],
        recommendations: existing?.recommendations || [],
        findingsSummary: existing?.findingsSummary || null,
        skills: existing?.skills || [],
        analysisSummary: existing?.analysisSummary || null,
        metadata: {
          ...(existing?.metadata || {}),
          failureReason: message.reason || 'Unknown analysis failure',
        },
      };
    }

    if (state) {
      if (contributorLogin && !state.failed.includes(contributorLogin)) {
        state.failed.push(contributorLogin);
      }
      state.activeContributor = null;
    }

    repo.analysisStatus = state?.queue.length ? 'in_progress' : 'failed';
    repo.analysisProgress = this.computeBatchProgress(state, message.progress ?? 100);
    repo.analysisCurrentStage = contributorLogin
      ? `Failed analysis for @${contributorLogin}`
      : message.stage || 'Analysis failed';
    this.setRepositoryMetadata(repo, {
      contributorProfiles: profiles,
      contributorAnalysis: state,
      failureReason: message.reason || 'Unknown analysis failure',
    });
    await this.repositoryRepo.save(repo);

    await this.startNextContributorAnalysis(repo.id);
  }

  async updateRepositoryAnalysisStatus(
    repositoryId: string,
    status: AnalysisStatus,
  ): Promise<void> {
    await this.updateRepositoryAnalysis(repositoryId, { status });
  }

  async updateRepositoryAnalysis(
    repositoryId: string,
    update: {
      status?: AnalysisStatus;
      progress?: number;
      stage?: string | null;
      summary?: Record<string, any> | null;
      detectedSkills?: Record<string, any>[] | null;
      metadata?: Record<string, any> | null;
      failureReason?: string | null;
    },
  ): Promise<void> {
    const repo = await this.repositoryRepo.findOne({
      where: { id: repositoryId },
    });
    if (!repo) {
      return;
    }

    const currentProgress = repo.analysisProgress || 0;
    const incomingProgress =
      typeof update.progress === 'number'
        ? Math.max(0, Math.min(100, update.progress))
        : null;

    if (update.status) {
      repo.analysisStatus = update.status;
      repo.isAnalyzed = update.status === 'completed';
      if (update.status === 'completed') {
        repo.lastAnalyzedAt = new Date();
        repo.analysisProgress = 100;
      }
    }

    if (incomingProgress !== null && incomingProgress >= currentProgress) {
      repo.analysisProgress = incomingProgress;
    }

    if (typeof update.stage !== 'undefined') {
      repo.analysisCurrentStage = update.stage;
    }

    if (typeof update.summary !== 'undefined') {
      repo.analysisSummary = update.summary;
    }

    if (typeof update.detectedSkills !== 'undefined') {
      repo.analysisDetectedSkills = update.detectedSkills;
    }

    if (typeof update.metadata !== 'undefined') {
      this.setRepositoryMetadata(repo, update.metadata || {});
    }

    if (update.failureReason) {
      this.setRepositoryMetadata(repo, {
        failureReason: update.failureReason,
      });
    }

    await this.repositoryRepo.save(repo);
  }
}
