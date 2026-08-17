import { formatDate, formatDateTime, timeAgo } from './format';

describe('formatDate', () => {
  it('renders a long en-US date', () => {
    expect(formatDate('2024-03-09T12:00:00Z')).toBe('March 9, 2024');
  });

  it('accepts a Date instance as well as an ISO string', () => {
    expect(formatDate(new Date('2024-03-09T12:00:00Z'))).toBe(
      formatDate('2024-03-09T12:00:00Z'),
    );
  });
});

describe('formatDateTime', () => {
  // The exact date/time separator is ICU-version dependent, so assert on the
  // parts the function actually controls rather than the whole string.
  it('keeps the long date and appends a zero-padded 12-hour time', () => {
    const formatted = formatDateTime('2024-03-09T12:05:00Z');

    expect(formatted).toContain('March 9, 2024');
    expect(formatted).toContain('12:05');
    expect(formatted).toMatch(/PM$/);
  });

  it('zero-pads single-digit hours', () => {
    expect(formatDateTime('2024-03-09T09:05:00Z')).toContain('09:05');
  });
});

describe('timeAgo', () => {
  const now = new Date('2024-03-09T12:00:00Z');
  const minutesAgo = (minutes: number) =>
    new Date(now.getTime() - minutes * 60_000).toISOString();

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(now);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('reports sub-minute differences as "just now"', () => {
    expect(timeAgo(minutesAgo(0.5))).toBe('just now');
  });

  it('uses the singular form at exactly one minute', () => {
    expect(timeAgo(minutesAgo(1))).toBe('1 minute ago');
  });

  it('pluralises minutes', () => {
    expect(timeAgo(minutesAgo(5))).toBe('5 minutes ago');
  });

  it('switches to hours once a full hour has passed', () => {
    expect(timeAgo(minutesAgo(60))).toBe('1 hour ago');
    expect(timeAgo(minutesAgo(150))).toBe('2 hours ago');
  });

  it('switches to days once a full day has passed', () => {
    expect(timeAgo(minutesAgo(60 * 24))).toBe('1 day ago');
    expect(timeAgo(minutesAgo(60 * 24 * 3))).toBe('3 days ago');
  });

  it('falls back to an absolute date beyond 30 days', () => {
    const older = minutesAgo(60 * 24 * 45);
    expect(timeAgo(older)).toBe(formatDate(older));
  });
});
