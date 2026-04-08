import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Octokit } from '@octokit/rest';
import { Buffer } from 'buffer';

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

interface AnalysisJobPayload {
  repositoryId: string;
  integrationId: string;
  developer_id: string;
  repoName: string;
  repoUrl: string;
  githubUsername: string;
  analyzedAt: string;
  files: Record<string, string>;
  diff: string;
  commit_message: string;
  existing_profile: Record<string, any> | null;
  metadata: Record<string, any>;
}

interface ChunkEnvelopePayload {
  repositoryId: string;
  integrationId: string;
  developerId: string;
  transport: {
    encoding: 'base64';
    chunkIndex: number;
    chunkCount: number;
    payload: string;
    totalBytes: number;
  };
}

@Injectable()
export class CommitAnalysisService {
  private readonly logger = new Logger(CommitAnalysisService.name);
  private readonly maxCommitsPerAnalysis = parseInt(
    process.env.MAX_COMMITS_PER_ANALYSIS || '0',
    10,
  );
  private readonly maxFilesPerAnalysis = parseInt(
    process.env.MAX_FILES_PER_ANALYSIS || '0',
    10,
  );
  private readonly maxDiffChars = parseInt(
    process.env.MAX_DIFF_CHARS_PER_ANALYSIS || '0',
    10,
  );
  private readonly maxSnapshotChunkBytes = parseInt(
    process.env.ANALYSIS_SNAPSHOT_CHUNK_BYTES || '240000',
    10,
  );
  private readonly supportedCodeExtensions = new Set([
    '.py',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.java',
    '.go',
    '.rs',
  ]);

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

      const selectedCommits =
        this.maxCommitsPerAnalysis > 0
          ? commits.slice(0, this.maxCommitsPerAnalysis)
          : commits;
      const totalDeveloperCommitsFound = commits.length;
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

      this.emitProgress(event, 58, 'Collecting source file snapshots');
      const { files, fileLimitApplied } = await this.collectFilesWithContent(
        event,
        octokit,
        repoCoordinates.owner,
        repoCoordinates.repo,
        detailedCommits,
      );
      const diff = this.buildCombinedDiff(detailedCommits);
      const commitMessage = selectedCommits
        .slice(0, 5)
        .map((commit) => commit.commit.message.split('\n')[0]?.trim())
        .filter(Boolean)
        .join(' | ');

      if (!diff.trim() || Object.keys(files).length === 0) {
        this.emitFailure(
          event,
          'Could not assemble code diffs and source files for analysis',
        );
        return;
      }

      const job: AnalysisJobPayload = {
        repositoryId: event.repositoryId,
        integrationId: event.integrationId,
        developer_id: event.developerId,
        repoName: event.repoName,
        repoUrl: event.repoUrl,
        githubUsername: event.githubUsername,
        analyzedAt: new Date().toISOString(),
        files,
        diff,
        commit_message: commitMessage || `Repository analysis for ${event.repoName}`,
        existing_profile: null,
        metadata: {
          contributorCount: contributors.length,
          developerContributionCount:
            linkedContributor?.contributions || totalDeveloperCommitsFound,
          developerCommitsFound: totalDeveloperCommitsFound,
          commitsAnalyzed: detailedCommits.length,
          commitLimitApplied:
            this.maxCommitsPerAnalysis > 0 &&
            totalDeveloperCommitsFound > this.maxCommitsPerAnalysis,
          maxCommitsPerAnalysis:
            this.maxCommitsPerAnalysis > 0 ? this.maxCommitsPerAnalysis : null,
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
          filesTouched: Object.keys(files).length,
          fileLimitApplied,
          maxFilesPerAnalysis:
            this.maxFilesPerAnalysis > 0 ? this.maxFilesPerAnalysis : null,
          diffTruncated: diff.includes('[truncated for analysis size]'),
          maxDiffCharsPerAnalysis:
            this.maxDiffChars > 0 ? this.maxDiffChars : null,
          sampledCommitShas: detailedCommits.map((commit) => commit.sha),
        },
      };
      this.emitSnapshotToNlp(event, job);
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

  private async collectFilesWithContent(
    event: AnalysisRequestedEvent,
    octokit: Octokit,
    owner: string,
    repo: string,
    commits: CommitPayload[],
  ) {
    const files = new Map<string, string>();
    const seenFilenames = new Set<string>();
    const candidates = commits.flatMap((commit) =>
      commit.files.map((file) => ({ commitSha: commit.sha, file })),
    );
    const eligibleFiles = candidates.filter(
      ({ file }) => {
        if (!this.shouldFetchFile(file.filename, file.status)) {
          return false;
        }
        if (seenFilenames.has(file.filename)) {
          return false;
        }
        seenFilenames.add(file.filename);
        return true;
      },
    );
    const limitedFiles =
      this.maxFilesPerAnalysis > 0
        ? eligibleFiles.slice(0, this.maxFilesPerAnalysis)
        : eligibleFiles;
    const totalFiles = limitedFiles.length;

    for (const [index, entry] of limitedFiles.entries()) {
      const { file, commitSha } = entry;
      try {
        const response = await octokit.repos.getContent({
          owner,
          repo,
          path: file.filename,
          ref: commitSha,
        });
        const data = response.data;
        if (Array.isArray(data) || !('content' in data) || !data.content) {
          continue;
        }

        const encoding = data.encoding === 'base64' ? 'base64' : 'utf8';
        const content = Buffer.from(data.content, encoding).toString('utf8');
        if (content.trim()) {
          files.set(file.filename, content);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown file fetch error';
        this.logger.warn(
          `Skipping file ${file.filename} at ${commitSha}: ${message}`,
        );
      }

      if (totalFiles > 0) {
        const progress = 58 + Math.min(5, Math.floor(((index + 1) / totalFiles) * 5));
        this.emitProgress(
          event,
          progress,
          `Collecting source file snapshots (${index + 1}/${totalFiles})`,
        );
      }
    }

    return {
      files: Object.fromEntries(files),
      fileLimitApplied:
        this.maxFilesPerAnalysis > 0 &&
        eligibleFiles.length > this.maxFilesPerAnalysis,
    };
  }

  private shouldFetchFile(filename: string, status?: string) {
    if (status === 'removed') {
      return false;
    }

    const normalized = filename.toLowerCase();
    for (const extension of this.supportedCodeExtensions) {
      if (normalized.endsWith(extension)) {
        return true;
      }
    }

    return false;
  }

  private buildCombinedDiff(commits: CommitPayload[]) {
    const combinedDiff = commits
      .map((commit) => {
        const fileDiffs = commit.files
          .filter((file) => file.patch)
          .map(
            (file) =>
              `diff --git a/${file.filename} b/${file.filename}\n${file.patch}`,
          )
          .join('\n\n');

        return [
          `commit ${commit.sha}`,
          `message: ${commit.message}`,
          fileDiffs,
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');

    if (this.maxDiffChars <= 0 || combinedDiff.length <= this.maxDiffChars) {
      return combinedDiff;
    }

    return `${combinedDiff.slice(0, this.maxDiffChars)}\n\n[truncated for analysis size]`;
  }

  private emitSnapshotToNlp(
    event: AnalysisRequestedEvent,
    job: AnalysisJobPayload,
  ) {
    const serializedJob = Buffer.from(JSON.stringify(job), 'utf8');
    const chunkSize = Math.max(32768, this.maxSnapshotChunkBytes);
    const chunkCount = Math.max(1, Math.ceil(serializedJob.length / chunkSize));

    for (let offset = 0; offset < serializedJob.length; offset += chunkSize) {
      const chunkIndex = Math.floor(offset / chunkSize) + 1;
      const chunkPayload = serializedJob
        .subarray(offset, offset + chunkSize)
        .toString('base64');

      this.emitProgress(
        event,
        65,
        `Sending repository snapshot to NLP (${chunkIndex}/${chunkCount})`,
      );

      const envelope: ChunkEnvelopePayload = {
        repositoryId: event.repositoryId,
        integrationId: event.integrationId,
        developerId: event.developerId,
        transport: {
          encoding: 'base64',
          chunkIndex,
          chunkCount,
          payload: chunkPayload,
          totalBytes: serializedJob.length,
        },
      };

      this.kafkaClient.emit('commit.analysis', {
        key: event.repositoryId,
        value: JSON.stringify(envelope),
      });
    }
  }
}
