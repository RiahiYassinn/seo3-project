import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Octokit } from '@octokit/rest';

interface AnalysisRequestedEvent {
  repositoryId: string;
  integrationId: string;
  developerId: string;
  repoName: string;
  repoUrl: string;
  githubUsername: string;
  githubToken: string;
}

interface CommitFilePayload {
  filename: string;
  status?: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface CommitPayload {
  sha: string;
  message: string;
  committedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  filesChanged: string[];
  files: CommitFilePayload[];
}

@Injectable()
export class CommitAnalysisService {
  private readonly logger = new Logger(CommitAnalysisService.name);
  private readonly maxCommitsPerAnalysis = parseInt(
    process.env.MAX_COMMITS_PER_ANALYSIS || '40',
    10,
  );

  constructor(
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async queueRepositoryAnalysis(event: AnalysisRequestedEvent) {
    try {
      this.emitProgress(event, 15, 'Preparing repository context');
      const repoCoordinates = this.parseRepositoryUrl(event.repoUrl);
      const octokit = new Octokit({ auth: event.githubToken });

      this.emitProgress(event, 35, 'Fetching linked developer commits');
      const commits = await octokit.paginate(octokit.repos.listCommits, {
        owner: repoCoordinates.owner,
        repo: repoCoordinates.repo,
        author: event.githubUsername,
        per_page: 100,
      });

      const selectedCommits = commits.slice(0, this.maxCommitsPerAnalysis);
      if (selectedCommits.length === 0) {
        this.emitFailure(event, 'No commits found for the linked GitHub account');
        return;
      }

      this.emitProgress(event, 50, 'Collecting commit diff metadata');
      const detailedCommits = await Promise.all(
        selectedCommits.map(async (commit) => {
          const { data } = await octokit.repos.getCommit({
            owner: repoCoordinates.owner,
            repo: repoCoordinates.repo,
            ref: commit.sha,
          });

          return {
            sha: data.sha,
            message: data.commit.message,
            committedAt: data.commit.author?.date || new Date().toISOString(),
            additions: data.stats?.additions || 0,
            deletions: data.stats?.deletions || 0,
            changedFiles: data.files?.length || 0,
            filesChanged: (data.files || []).map((file) => file.filename),
            files: (data.files || []).map((file) => ({
              filename: file.filename,
              status: file.status,
              additions: file.additions || 0,
              deletions: file.deletions || 0,
              changes: file.changes || 0,
              patch: file.patch,
            })),
          } satisfies CommitPayload;
        }),
      );

      const contributors = await octokit.repos
        .listContributors({
          owner: repoCoordinates.owner,
          repo: repoCoordinates.repo,
          per_page: 100,
        })
        .then((response) => response.data)
        .catch(() => []);

      const linkedContributor = contributors.find(
        (contributor) =>
          contributor.login?.toLowerCase() === event.githubUsername.toLowerCase(),
      );
      let totalContributions = 0;
      for (const contributor of contributors) {
        totalContributions += contributor.contributions || 0;
      }

      this.emitProgress(event, 65, 'Sending repository snapshot to NLP');
      const job = {
        repositoryId: event.repositoryId,
        integrationId: event.integrationId,
        developerId: event.developerId,
        repoName: event.repoName,
        repoUrl: event.repoUrl,
        githubUsername: event.githubUsername,
        analyzedAt: new Date().toISOString(),
        repositoryStats: {
          contributorCount: contributors.length,
          developerContributionCount:
            linkedContributor?.contributions || selectedCommits.length,
          developerContributionShare:
            totalContributions > 0 && linkedContributor
              ? Number(
                  (
                    linkedContributor.contributions / totalContributions
                  ).toFixed(4),
                )
              : null,
          totalContributorCommits: totalContributions,
          analyzedCommitCount: detailedCommits.length,
        },
        commits: detailedCommits,
      };

      this.kafkaClient.emit('commit.analysis', {
        key: event.repositoryId,
        value: JSON.stringify(job),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Repository analysis failed';
      this.logger.error(`Failed to prepare repository analysis: ${message}`);
      this.emitFailure(event, message);
    }
  }

  private emitFailure(event: AnalysisRequestedEvent, reason: string) {
    this.kafkaClient.emit('analysis.failed', {
      key: event.repositoryId,
      value: JSON.stringify({
        repositoryId: event.repositoryId,
        developerId: event.developerId,
        integrationId: event.integrationId,
        reason,
        progress: 100,
        stage: 'Analysis failed',
        failedAt: new Date().toISOString(),
      }),
    });
  }

  private emitProgress(
    event: AnalysisRequestedEvent,
    progress: number,
    stage: string,
  ) {
    this.kafkaClient.emit('analysis.progress', {
      key: event.repositoryId,
      value: JSON.stringify({
        repositoryId: event.repositoryId,
        developerId: event.developerId,
        integrationId: event.integrationId,
        progress,
        stage,
        updatedAt: new Date().toISOString(),
      }),
    });
  }

  private parseRepositoryUrl(repoUrl: string) {
    const url = new URL(repoUrl);
    const [owner, repo] = url.pathname.replace(/^\/+/, '').split('/');

    return {
      owner,
      repo: repo?.replace(/\.git$/, ''),
    };
  }
}
