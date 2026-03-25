export class AnalysisRequestedEvent {
  readonly topic = 'analysis.requested';

  constructor(
    public readonly repositoryId: string,
    public readonly integrationId: string,
    public readonly developerId: string,
    public readonly repoName: string,
    public readonly repoUrl: string,
    public readonly githubUsername: string,
  ) {}
}