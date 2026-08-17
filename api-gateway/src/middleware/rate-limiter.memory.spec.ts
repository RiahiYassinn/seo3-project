import { Logger } from '@nestjs/common';
import { RateLimiterMemory } from './rate-limiter.memory';

/**
 * Exercised against the real `rate-limiter-flexible` in-memory store: it has no
 * I/O, so stubbing it would only test the stub.
 */
describe('RateLimiterMemory', () => {
  let limiter: RateLimiterMemory;

  beforeAll(() => {
    // This class logs on every construction; keep the reporter readable.
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    limiter = new RateLimiterMemory();
  });

  describe('default limiters', () => {
    it.each([
      ['auth', 5],
      ['api', 100],
      ['public', 30],
    ])('registers %s with %i points', async (name, points) => {
      const result = await limiter.consume(name, `key-${name}`);

      expect(result).toMatchObject({ success: true, consumedPoints: 1 });
      expect(result.remainingPoints).toBe(points - 1);
    });
  });

  describe('consume', () => {
    it('decrements the remaining budget per key', async () => {
      await limiter.consume('auth', 'ip-a');
      const second = await limiter.consume('auth', 'ip-a');

      expect(second.remainingPoints).toBe(3);
    });

    it('keeps budgets isolated between keys', async () => {
      await limiter.consume('auth', 'ip-a');
      const other = await limiter.consume('auth', 'ip-b');

      expect(other.remainingPoints).toBe(4);
    });

    it('can spend several points at once', async () => {
      const result = await limiter.consume('auth', 'ip-bulk', 3);

      expect(result.consumedPoints).toBe(3);
      expect(result.remainingPoints).toBe(2);
    });

    it('reports failure once the budget is exhausted', async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await limiter.consume('auth', 'ip-hot');
      }

      const blocked = await limiter.consume('auth', 'ip-hot');

      expect(blocked.success).toBe(false);
      expect(blocked.msBeforeNext).toBeGreaterThan(0);
    });

    it('falls back to the api limiter for an unknown name', async () => {
      const result = await limiter.consume('does-not-exist', 'ip-a');

      expect(result.remainingPoints).toBe(99);
    });
  });

  describe('createLimiter', () => {
    it('registers a custom budget that overrides an existing name', async () => {
      limiter.createLimiter('auth', { points: 2, duration: 60 });

      const result = await limiter.consume('auth', 'ip-a');

      expect(result.remainingPoints).toBe(1);
    });
  });

  describe('get / delete / block', () => {
    it('reports null for a key that has never been seen', async () => {
      await expect(limiter.get('auth', 'unseen')).resolves.toBeNull();
    });

    it('reports null for an unknown limiter name', async () => {
      await expect(limiter.get('nope', 'ip-a')).resolves.toBeNull();
    });

    it('returns the consumed points for a known key', async () => {
      await limiter.consume('auth', 'ip-a', 2);

      await expect(limiter.get('auth', 'ip-a')).resolves.toMatchObject({
        consumedPoints: 2,
      });
    });

    it('delete restores the full budget', async () => {
      await limiter.consume('auth', 'ip-a', 4);
      await limiter.delete('auth', 'ip-a');

      const result = await limiter.consume('auth', 'ip-a');
      expect(result.remainingPoints).toBe(4);
    });

    it('delete on an unknown limiter is a no-op', async () => {
      await expect(limiter.delete('nope', 'ip-a')).resolves.toBeUndefined();
    });

    it('block rejects the next request from that key', async () => {
      await limiter.block('auth', 'ip-bad', 60);

      const result = await limiter.consume('auth', 'ip-bad');
      expect(result.success).toBe(false);
    });

    it('block on an unknown limiter is a no-op', async () => {
      await expect(limiter.block('nope', 'ip-a', 60)).resolves.toBeUndefined();
    });
  });

  describe('resetAll', () => {
    it('resolves for every registered limiter', async () => {
      await limiter.consume('auth', 'ip-a');

      await expect(limiter.resetAll()).resolves.toBeUndefined();
    });
  });
});
