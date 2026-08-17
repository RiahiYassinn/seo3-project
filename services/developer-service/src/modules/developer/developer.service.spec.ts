import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { Developer } from './entities/developer.entity';

const developer = (overrides: Partial<Developer> = {}): Developer =>
  ({
    id: 'dev-1',
    email: 'dev@devlab.io',
    username: 'dev',
    firstName: 'Ada',
    lastName: 'Lovelace',
    passwordHash: 'hashed',
    role: 'developer',
    isEmailVerified: true,
    isActive: true,
    isMentor: false,
    lastLoginAt: null,
    avatar: null,
    bio: null,
    location: null,
    website: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  }) as Developer;

/**
 * TypeORM repository double: `update` mutates the seeded row so a subsequent
 * `findOne` reflects the write, which is what the service relies on when it
 * re-reads after a save.
 */
const createRepo = (rows: Developer[]) => ({
  rows,
  findOne: jest.fn(async ({ where }: any) => {
    const clauses = Array.isArray(where) ? where : [where];
    return (
      rows.find((row) =>
        clauses.some((clause: any) =>
          Object.entries(clause).every(
            ([key, value]) => (row as any)[key] === value,
          ),
        ),
      ) || null
    );
  }),
  update: jest.fn(async (id: string, patch: Partial<Developer>) => {
    const row = rows.find((item) => item.id === id);
    if (row) Object.assign(row, patch);
    return { affected: row ? 1 : 0 };
  }),
  create: jest.fn((data: Partial<Developer>) => developer(data)),
  save: jest.fn(async (value: Developer) => value),
  remove: jest.fn(async (value: Developer) => value),
});

const build = (rows: Developer[] = []) => {
  const repo = createRepo(rows);
  const noopRepo = {} as never;
  const service = new DeveloperService(
    repo as never,
    noopRepo,
    noopRepo,
    noopRepo,
  );

  return { service, repo };
};

describe('toUserDto', () => {
  it('maps camelCase entity fields onto the snake_case gateway contract', () => {
    const { service } = build();

    expect(service.toUserDto(developer())).toMatchObject({
      id: 'dev-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      is_email_verified: true,
      is_active: true,
      is_mentor: false,
    });
  });

  it('flags a user who has never logged in as a first login', () => {
    const { service } = build();

    expect(service.toUserDto(developer({ lastLoginAt: null })).is_first_login).toBe(
      true,
    );
  });

  it('clears the first-login flag once a login is recorded', () => {
    const { service } = build();

    expect(
      service.toUserDto(developer({ lastLoginAt: new Date('2024-03-01') }))
        .is_first_login,
    ).toBe(false);
  });
});

describe('findOne', () => {
  it('returns the matching developer', async () => {
    const { service } = build([developer()]);

    await expect(service.findOne('dev-1')).resolves.toMatchObject({ id: 'dev-1' });
  });

  it('throws NotFound with the id in the message', async () => {
    const { service } = build([]);

    await expect(service.findOne('missing')).rejects.toThrow(
      'Developer with ID missing not found',
    );
  });
});

describe('checkUserExists', () => {
  it.each([
    ['a matching email', 'dev@devlab.io', 'someone-else'],
    ['a matching username', 'other@devlab.io', 'dev'],
  ])('reports true for %s', async (_label, email, username) => {
    const { service } = build([developer()]);

    await expect(service.checkUserExists(email, username)).resolves.toEqual({
      exists: true,
    });
  });

  it('reports false when neither matches', async () => {
    const { service } = build([developer()]);

    await expect(
      service.checkUserExists('new@devlab.io', 'new'),
    ).resolves.toEqual({ exists: false });
  });
});

describe('createUser', () => {
  it.each(['developer', 'tech_lead', 'admin'])('accepts the %s role', async (role) => {
    const { service } = build([]);

    const created = await service.createUser({
      email: 'a@b.c',
      firstName: 'A',
      lastName: 'B',
      password: 'hashed',
      role,
    });

    expect(created.role).toBe(role);
  });

  it.each([
    ['an unknown role', 'superuser'],
    ['no role at all', undefined],
  ])('falls back to developer for %s', async (_label, role) => {
    const { service } = build([]);

    const created = await service.createUser({
      email: 'a@b.c',
      firstName: 'A',
      lastName: 'B',
      password: 'hashed',
      role,
    });

    expect(created.role).toBe('developer');
  });

  it('stores the supplied hash and starts the account unverified but active', async () => {
    const { service } = build([]);

    const created = await service.createUser({
      email: 'a@b.c',
      firstName: 'A',
      lastName: 'B',
      password: 'already-hashed',
    });

    expect(created).toMatchObject({
      passwordHash: 'already-hashed',
      isEmailVerified: false,
      isActive: true,
    });
  });
});

describe('updateMentorAvailability', () => {
  it('marks a tech lead as available', async () => {
    const { service } = build([developer({ role: 'tech_lead' })]);

    await expect(
      service.updateMentorAvailability('dev-1', true),
    ).resolves.toMatchObject({ isMentor: true });
  });

  it.each(['developer', 'admin'])('refuses to mark a %s as a mentor', async (role) => {
    const { service, repo } = build([developer({ role })]);

    await expect(
      service.updateMentorAvailability('dev-1', true),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('propagates NotFound for an unknown user', async () => {
    const { service } = build([]);

    await expect(
      service.updateMentorAvailability('nobody', true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('updateOwnProfile', () => {
  it('trims and applies the editable name fields', async () => {
    const { service } = build([developer()]);

    const updated = await service.updateOwnProfile('dev-1', {
      firstName: '  Grace  ',
      lastName: '  Hopper  ',
    });

    expect(updated).toMatchObject({ firstName: 'Grace', lastName: 'Hopper' });
  });

  it.each([
    ['username', 'Username cannot be empty'],
    ['firstName', 'First name cannot be empty'],
    ['lastName', 'Last name cannot be empty'],
  ])('rejects a whitespace-only %s', async (field, message) => {
    const { service } = build([developer()]);

    await expect(
      service.updateOwnProfile('dev-1', { [field]: '   ' }),
    ).rejects.toThrow(message);
  });

  it('rejects a username already held by someone else', async () => {
    const { service } = build([
      developer(),
      developer({ id: 'dev-2', username: 'taken', email: 'two@devlab.io' }),
    ]);

    await expect(
      service.updateOwnProfile('dev-1', { username: 'taken' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows re-submitting the user’s own current username', async () => {
    const { service, repo } = build([developer()]);

    await service.updateOwnProfile('dev-1', { username: 'dev' });

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('accepts a genuinely free username', async () => {
    const { service } = build([developer()]);

    await expect(
      service.updateOwnProfile('dev-1', { username: 'ada' }),
    ).resolves.toMatchObject({ username: 'ada' });
  });

  it.each(['bio', 'location', 'website'] as const)(
    'clears %s when an empty string is submitted',
    async (field) => {
      const { service } = build([developer({ [field]: 'previous' } as never)]);

      const updated = await service.updateOwnProfile('dev-1', { [field]: '  ' });

      expect(updated[field]).toBeNull();
    },
  );

  it('clears the avatar when null is submitted', async () => {
    const { service } = build([developer({ avatar: '/uploads/avatars/a.png' })]);

    const updated = await service.updateOwnProfile('dev-1', { avatar: null });

    expect(updated.avatar).toBeNull();
  });

  it('ignores fields that were not submitted at all', async () => {
    const { service } = build([developer({ bio: 'kept' })]);

    const updated = await service.updateOwnProfile('dev-1', { firstName: 'Grace' });

    expect(updated.bio).toBe('kept');
  });

  it('skips the write entirely when nothing changed', async () => {
    const { service, repo } = build([developer()]);

    const result = await service.updateOwnProfile('dev-1', {});

    expect(repo.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'dev-1' });
  });

  it('never lets a self-service edit touch role, email or activation', async () => {
    const { service, repo } = build([developer()]);

    await service.updateOwnProfile('dev-1', {
      firstName: 'Grace',
      role: 'admin',
      email: 'attacker@evil.io',
      isActive: false,
    } as never);

    expect(repo.update).toHaveBeenCalledWith('dev-1', { firstName: 'Grace' });
  });
});
