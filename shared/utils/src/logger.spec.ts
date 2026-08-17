import { createLogger, Logger } from './logger';

describe('Logger', () => {
  const spies = {
    log: jest.spyOn(console, 'log').mockImplementation(() => undefined),
    error: jest.spyOn(console, 'error').mockImplementation(() => undefined),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    debug: jest.spyOn(console, 'debug').mockImplementation(() => undefined),
  };

  /** Every level emits a single JSON string; this is the only way to read it. */
  const lastPayload = (spy: jest.SpyInstance) =>
    JSON.parse(spy.mock.calls.at(-1)?.[0] as string);

  const logger = createLogger('api-gateway');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('createLogger returns a Logger bound to the service name', () => {
    expect(logger).toBeInstanceOf(Logger);

    logger.info('ready');

    expect(lastPayload(spies.log)).toMatchObject({
      level: 'info',
      service: 'api-gateway',
      message: 'ready',
    });
  });

  it('emits structured JSON with an ISO timestamp', () => {
    logger.info('ready');

    const payload = lastPayload(spies.log);
    expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
  });

  it('passes metadata through untouched', () => {
    logger.warn('slow query', { ms: 1200 });

    expect(lastPayload(spies.warn)).toMatchObject({
      level: 'warn',
      meta: { ms: 1200 },
    });
  });

  it('flattens an Error into message and stack', () => {
    logger.error('boom', new Error('kafka unreachable'));

    const payload = lastPayload(spies.error);
    expect(payload.error).toBe('kafka unreachable');
    expect(payload.stack).toContain('kafka unreachable');
  });

  it('logs a non-Error rejection value as-is', () => {
    logger.error('boom', 'plain string reason');

    expect(lastPayload(spies.error).error).toBe('plain string reason');
  });

  describe('debug', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('is suppressed outside development', () => {
      process.env.NODE_ENV = 'production';
      logger.debug('verbose');

      expect(spies.debug).not.toHaveBeenCalled();
    });

    it('is emitted in development', () => {
      process.env.NODE_ENV = 'development';
      logger.debug('verbose');

      expect(lastPayload(spies.debug)).toMatchObject({
        level: 'debug',
        message: 'verbose',
      });
    });
  });
});
