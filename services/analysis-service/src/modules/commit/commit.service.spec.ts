import { Logger } from '@nestjs/common';
import { CommitAnalysisService } from './commit.service';

/**
 * The public entry point talks to GitHub and Kafka. The behaviour worth pinning
 * down lives in the helpers underneath it — file selection, diff assembly,
 * retry backoff, the TTL cache and the bounded-concurrency mapper — so those are
 * reached directly rather than through a mocked Octokit.
 */
type ServiceInternals = {
  parseRepositoryUrl(repoUrl: string): { owner: string; repo?: string };
  shouldFetchFile(filename: string, status?: string): boolean;
  buildCombinedDiff(commits: unknown[]): string;
  resolveRetryDelayMs(
    retryAfterSeconds: number,
    resetAtSeconds: number,
    attempt: number,
  ): number;
  getCacheValue<T>(cache: Map<string, unknown>, key: string): T | null;
  setCacheValue<T>(cache: Map<string, unknown>, key: string, value: T): void;
  mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]>;
};

const commit = (overrides: Record<string, unknown> = {}) => ({
  sha: 'abc123',
  message: 'feat: add thing',
  committedAt: '2024-03-09T12:00:00Z',
  additions: 1,
  deletions: 0,
  changedFiles: 1,
  filesChanged: ['src/a.ts'],
  files: [{ filename: 'src/a.ts', additions: 1, deletions: 0, changes: 1, patch: '+a' }],
  ...overrides,
});

describe('CommitAnalysisService', () => {
  let service: ServiceInternals;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    const kafkaClient = { emit: jest.fn() };
    service = new CommitAnalysisService(kafkaClient as never) as never;
  });

  describe('parseRepositoryUrl', () => {
    it('splits owner and repo out of a GitHub URL', () => {
      expect(service.parseRepositoryUrl('https://github.com/devlab/platform')).toEqual({
        owner: 'devlab',
        repo: 'platform',
      });
    });

    it('strips a trailing .git suffix', () => {
      expect(
        service.parseRepositoryUrl('https://github.com/devlab/platform.git').repo,
      ).toBe('platform');
    });

    it('tolerates extra path segments after the repo', () => {
      expect(
        service.parseRepositoryUrl('https://github.com/devlab/platform/tree/main'),
      ).toMatchObject({ owner: 'devlab', repo: 'platform' });
    });

    it('throws on a value that is not a URL', () => {
      expect(() => service.parseRepositoryUrl('devlab/platform')).toThrow();
    });
  });

  describe('shouldFetchFile', () => {
    it.each(['src/a.ts', 'app/page.tsx', 'main.py', 'lib/x.js', 'ui/y.jsx', 'A.java', 'm.go', 'l.rs'])(
      'fetches %s',
      (filename) => {
        expect(service.shouldFetchFile(filename)).toBe(true);
      },
    );

    it('matches extensions case-insensitively', () => {
      expect(service.shouldFetchFile('src/Component.TSX')).toBe(true);
    });

    it.each(['README.md', 'package-lock.json', 'logo.png', 'Dockerfile', 'notes.txt'])(
      'skips %s',
      (filename) => {
        expect(service.shouldFetchFile(filename)).toBe(false);
      },
    );

    it('skips deleted files even when the extension is supported', () => {
      expect(service.shouldFetchFile('src/a.ts', 'removed')).toBe(false);
    });

    it('still fetches renamed and modified files', () => {
      expect(service.shouldFetchFile('src/a.ts', 'renamed')).toBe(true);
      expect(service.shouldFetchFile('src/a.ts', 'modified')).toBe(true);
    });
  });

  describe('buildCombinedDiff', () => {
    it('emits a git-style header per file so the NLP diff parser can read it', () => {
      const diff = service.buildCombinedDiff([commit()]);

      expect(diff).toContain('commit abc123');
      expect(diff).toContain('message: feat: add thing');
      expect(diff).toContain('diff --git a/src/a.ts b/src/a.ts');
    });

    it('omits files that carry no patch', () => {
      const diff = service.buildCombinedDiff([
        commit({
          files: [
            { filename: 'src/a.ts', patch: '+a' },
            { filename: 'assets/logo.png' },
          ],
        }),
      ]);

      expect(diff).toContain('src/a.ts');
      expect(diff).not.toContain('logo.png');
    });

    it('separates multiple commits', () => {
      const diff = service.buildCombinedDiff([
        commit({ sha: 'aaa' }),
        commit({ sha: 'bbb' }),
      ]);

      expect(diff).toContain('commit aaa');
      expect(diff).toContain('commit bbb');
    });

    it('returns an empty string for no commits', () => {
      expect(service.buildCombinedDiff([])).toBe('');
    });

    it('leaves the diff untruncated when no cap is configured', () => {
      const diff = service.buildCombinedDiff([commit({ message: 'x'.repeat(5000) })]);

      expect(diff).not.toContain('[truncated for analysis size]');
    });
  });

  describe('buildCombinedDiff with MAX_DIFF_CHARS_PER_ANALYSIS set', () => {
    const originalValue = process.env.MAX_DIFF_CHARS_PER_ANALYSIS;

    afterAll(() => {
      process.env.MAX_DIFF_CHARS_PER_ANALYSIS = originalValue;
    });

    it('truncates and marks anything past the cap', () => {
      process.env.MAX_DIFF_CHARS_PER_ANALYSIS = '80';
      const capped = new CommitAnalysisService({ emit: jest.fn() } as never) as never as ServiceInternals;

      const diff = capped.buildCombinedDiff([commit({ message: 'y'.repeat(500) })]);

      expect(diff).toContain('[truncated for analysis size]');
      expect(diff.replace('\n\n[truncated for analysis size]', '')).toHaveLength(80);
    });
  });

  describe('resolveRetryDelayMs', () => {
    it('honours an explicit Retry-After header', () => {
      expect(service.resolveRetryDelayMs(30, 0, 1)).toBe(30_000);
    });

    it('prefers Retry-After over the rate-limit reset time', () => {
      const resetIn10Minutes = Math.floor(Date.now() / 1000) + 600;

      expect(service.resolveRetryDelayMs(5, resetIn10Minutes, 1)).toBe(5_000);
    });

    it('waits until the rate-limit reset when only that is present', () => {
      const resetInOneMinute = Math.floor(Date.now() / 1000) + 60;
      const delay = service.resolveRetryDelayMs(0, resetInOneMinute, 1);

      expect(delay).toBeGreaterThan(50_000);
      expect(delay).toBeLessThanOrEqual(60_000);
    });

    it('never returns a negative wait for a reset time already in the past', () => {
      const resetInThePast = Math.floor(Date.now() / 1000) - 600;

      expect(service.resolveRetryDelayMs(0, resetInThePast, 1)).toBe(1_000);
    });

    it('backs off linearly when the response carries no timing hints', () => {
      expect(service.resolveRetryDelayMs(0, 0, 1)).toBe(2_000);
      expect(service.resolveRetryDelayMs(0, 0, 2)).toBe(4_000);
    });

    it('caps the blind backoff at 15s', () => {
      expect(service.resolveRetryDelayMs(0, 0, 50)).toBe(15_000);
    });
  });

  describe('TTL cache', () => {
    it('returns null for a key that was never written', () => {
      expect(service.getCacheValue(new Map(), 'missing')).toBeNull();
    });

    it('round-trips a stored value', () => {
      const cache = new Map();
      service.setCacheValue(cache, 'k', { hits: 1 });

      expect(service.getCacheValue(cache, 'k')).toEqual({ hits: 1 });
    });

    it('evicts an entry once its TTL has elapsed', () => {
      const cache = new Map();
      service.setCacheValue(cache, 'k', 'value');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 3_600_000);

      expect(service.getCacheValue(cache, 'k')).toBeNull();
      expect(cache.has('k')).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('mapWithConcurrency', () => {
    it('preserves input order regardless of completion order', async () => {
      const results = await service.mapWithConcurrency(
        [30, 10, 20, 0],
        2,
        async (delay) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return delay;
        },
      );

      expect(results).toEqual([30, 10, 20, 0]);
    });

    it('never runs more than `concurrency` workers at once', async () => {
      let inFlight = 0;
      let peak = 0;

      await service.mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (item) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return item;
      });

      expect(peak).toBe(2);
    });

    it('handles an empty input list without hanging', async () => {
      await expect(
        service.mapWithConcurrency([], 4, async (item) => item),
      ).resolves.toEqual([]);
    });

    it('propagates a worker failure', async () => {
      await expect(
        service.mapWithConcurrency([1, 2], 2, async (item) => {
          if (item === 2) throw new Error('boom');
          return item;
        }),
      ).rejects.toThrow('boom');
    });
  });
});
