import { buildAdminWorkflowHref, readAdminWorkflowContext } from './admin-workflow';

/** Stands in for Next's `useSearchParams()` result. */
const params = (values: Record<string, string>) => ({
  get: (key: string) => (key in values ? values[key] : null),
});

describe('readAdminWorkflowContext', () => {
  it('reads every supported key off the query string', () => {
    expect(
      readAdminWorkflowContext(
        params({
          repo: 'repo-1',
          contributor: 'octocat',
          profile: 'profile-1',
          recommendation: 'rec-1',
        }),
      ),
    ).toEqual({
      repoId: 'repo-1',
      contributorLogin: 'octocat',
      profileId: 'profile-1',
      recommendationId: 'rec-1',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(readAdminWorkflowContext(params({ repo: '  repo-1  ' })).repoId).toBe(
      'repo-1',
    );
  });

  it('treats a blank value as absent rather than an empty string', () => {
    expect(readAdminWorkflowContext(params({ repo: '   ' })).repoId).toBeUndefined();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('returns an all-undefined context for %s search params', (_label, value) => {
    expect(readAdminWorkflowContext(value)).toEqual({
      repoId: undefined,
      contributorLogin: undefined,
      profileId: undefined,
      recommendationId: undefined,
    });
  });
});

describe('buildAdminWorkflowHref', () => {
  it('returns the bare pathname when there is no context', () => {
    expect(buildAdminWorkflowHref('/dashboard/admin')).toBe('/dashboard/admin');
  });

  it('returns the bare pathname when the context is empty', () => {
    expect(buildAdminWorkflowHref('/dashboard/admin', {})).toBe('/dashboard/admin');
  });

  it('emits the keys in a stable order so links stay comparable', () => {
    expect(
      buildAdminWorkflowHref('/dashboard/admin/profiles', {
        recommendationId: 'rec-1',
        profileId: 'profile-1',
        contributorLogin: 'octocat',
        repoId: 'repo-1',
      }),
    ).toBe(
      '/dashboard/admin/profiles?repo=repo-1&contributor=octocat&profile=profile-1&recommendation=rec-1',
    );
  });

  it('omits keys whose value is blank', () => {
    expect(
      buildAdminWorkflowHref('/x', { repoId: 'repo-1', contributorLogin: '  ' }),
    ).toBe('/x?repo=repo-1');
  });

  it('percent-encodes values that would otherwise break the query string', () => {
    expect(buildAdminWorkflowHref('/x', { contributorLogin: 'a b&c=d' })).toBe(
      '/x?contributor=a+b%26c%3Dd',
    );
  });

  it('round-trips through readAdminWorkflowContext', () => {
    const context = {
      repoId: 'repo-1',
      contributorLogin: 'octo cat',
      profileId: 'profile-1',
      recommendationId: 'rec-1',
    };

    const href = buildAdminWorkflowHref('/x', context);
    const query = new URLSearchParams(href.split('?')[1]);

    expect(readAdminWorkflowContext(query)).toEqual(context);
  });
});
