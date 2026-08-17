import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './notification.service';

let autoId = 0;

const notification = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: `n-${(autoId += 1)}`,
    recipientUserId: 'user-1',
    recipientRole: null,
    type: 'system',
    title: 'Title',
    message: 'Message',
    link: null,
    priority: 'info',
    metadata: {},
    readAt: null,
    readReceipts: {},
    dismissals: {},
    createdAt: new Date('2024-03-09T12:00:00Z'),
    updatedAt: new Date('2024-03-09T12:00:00Z'),
    ...overrides,
  }) as Notification;

/**
 * A hand-rolled repository double. TypeORM's real `find` is driven by SQL, so
 * the tests seed the rows a query would have returned and assert on the
 * filtering, mapping and read-state logic the service layers on top.
 */
const createRepo = (rows: Notification[] = []) => ({
  rows,
  find: jest.fn(async (_options?: any) => rows),
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
  create: jest.fn((data: Partial<Notification>) => notification(data)),
  save: jest.fn(async (value: Notification | Notification[]) => value),
  remove: jest.fn(async (value: Notification) => value),
});

const build = (rows: Notification[] = []) => {
  const repo = createRepo(rows);
  const developerService = { send: jest.fn((_pattern: string, _data: any) => of(null)) };
  const kafkaClient = { emit: jest.fn((_topic: string, _message: any) => undefined) };
  const service = new NotificationService(
    repo as never,
    developerService as never,
    kafkaClient as never,
  );

  return { service, repo, developerService, kafkaClient };
};

const dto = (overrides: Partial<CreateNotificationDto> = {}): CreateNotificationDto =>
  ({
    recipientUserId: 'user-1',
    title: 'Title',
    message: 'Message',
    ...overrides,
  }) as CreateNotificationDto;

beforeAll(() => {
  Logger.overrideLogger(false);
});

describe('create', () => {
  it('rejects a payload with no recipient of any kind', async () => {
    const { service } = build();

    await expect(
      service.create(dto({ recipientUserId: undefined })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['a blank title', { title: '   ' }],
    ['a blank message', { message: '   ' }],
    ['a missing title', { title: undefined }],
  ])('rejects %s', async (_label, overrides) => {
    const { service } = build();

    await expect(service.create(dto(overrides as never))).rejects.toThrow(
      'Notification title and message are required',
    );
  });

  it('fans out to every id in recipientUserIds', async () => {
    const { service, kafkaClient } = build();

    const created = await service.create(
      dto({ recipientUserId: undefined, recipientUserIds: ['a', 'b', 'c'] }),
    );

    expect(created.map((item) => item.recipient_user_id)).toEqual(['a', 'b', 'c']);
    expect(kafkaClient.emit).toHaveBeenCalledTimes(3);
  });

  it('creates both a personal row and a role broadcast when both are given', async () => {
    const { service } = build();

    const created = await service.create(
      dto({ recipientUserId: 'user-1', recipientRole: 'Tech Lead' }),
    );

    expect(created).toHaveLength(2);
    expect(created[1].recipient_role).toBe('tech_lead');
  });

  it.each([
    ['Tech Lead', 'tech_lead'],
    ['  ADMIN ', 'admin'],
    ['tech-lead', 'tech_lead'],
  ])('normalises the role %s to %s', async (input, expected) => {
    const { service } = build();

    const [created] = await service.create(
      dto({ recipientUserId: undefined, recipientRole: input }),
    );

    expect(created.recipient_role).toBe(expected);
  });

  it('trims title, message and link', async () => {
    const { service } = build();

    const [created] = await service.create(
      dto({ title: '  Hi  ', message: '  There  ', link: '  /x  ' }),
    );

    expect(created).toMatchObject({ title: 'Hi', message: 'There', link: '/x' });
  });

  it('stores a null link rather than an empty string', async () => {
    const { service } = build();

    const [created] = await service.create(dto({ link: '   ' }));

    expect(created.link).toBeNull();
  });

  it('emits a kafka event keyed by the recipient and flagged unread', async () => {
    const { service, kafkaClient } = build();

    const [created] = await service.create(dto());

    expect(kafkaClient.emit).toHaveBeenCalledWith('notification.created', {
      key: 'user-1',
      value: expect.any(String),
    });
    expect(JSON.parse(kafkaClient.emit.mock.calls[0][1].value)).toMatchObject({
      id: created.id,
      is_read: false,
    });
  });

  it('keys a role broadcast by the role', async () => {
    const { service, kafkaClient } = build();

    await service.create(dto({ recipientUserId: undefined, recipientRole: 'admin' }));

    expect(kafkaClient.emit.mock.calls[0][1].key).toBe('admin');
  });
});

describe('getForViewer', () => {
  it('queries the viewer id and, when present, their role', async () => {
    const { service, repo } = build();

    await service.getForViewer({ userId: 'user-1', role: 'Tech Lead' });

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [{ recipientUserId: 'user-1' }, { recipientRole: 'tech_lead' }],
      }),
    );
  });

  it('omits the role clause for a viewer with no role', async () => {
    const { service, repo } = build();

    await service.getForViewer({ userId: 'user-1' });

    expect(repo.find.mock.calls[0][0].where).toEqual([
      { recipientUserId: 'user-1' },
    ]);
  });

  it.each([
    ['clamps an oversized limit to 100', 500, 100],
    ['clamps a negative limit up to 1', -5, 1],
    ['falls back to 50 for a non-numeric limit', 'abc' as never, 50],
    // 0 is falsy, so it takes the `|| 50` default rather than the lower clamp.
    ['falls back to 50 for a zero limit', 0, 50],
    ['passes a sane limit through', 25, 25],
  ])('%s', async (_label, limit, expected) => {
    const { service, repo } = build();

    await service.getForViewer({ userId: 'user-1' }, limit);

    expect(repo.find.mock.calls[0][0].take).toBe(expected);
  });

  it('hides rows the viewer has dismissed', async () => {
    const { service } = build([
      notification({ id: 'keep' }),
      notification({ id: 'hidden', dismissals: { 'user-1': 'yesterday' } }),
    ]);

    const result = await service.getForViewer({ userId: 'user-1' });

    expect(result.notifications.map((item) => item.id)).toEqual(['keep']);
  });

  it('still shows a row dismissed by a different viewer', async () => {
    const { service } = build([
      notification({ id: 'shared', dismissals: { 'user-2': 'yesterday' } }),
    ]);

    const result = await service.getForViewer({ userId: 'user-1' });

    expect(result.notifications).toHaveLength(1);
  });

  it('counts only the unread rows', async () => {
    const { service } = build([
      notification({ readAt: null }),
      notification({ readAt: new Date('2024-03-09T13:00:00Z') }),
      notification({ readAt: null }),
    ]);

    const result = await service.getForViewer({ userId: 'user-1' });

    expect(result.unread_count).toBe(2);
  });

  describe('read state', () => {
    it('reads a personal row from readAt', async () => {
      const readAt = new Date('2024-03-09T13:00:00Z');
      const { service } = build([notification({ readAt })]);

      const [item] = (await service.getForViewer({ userId: 'user-1' })).notifications;

      expect(item).toMatchObject({ is_read: true, read_at: readAt.toISOString() });
    });

    it('reads a role broadcast from this viewer’s receipt', async () => {
      const { service } = build([
        notification({
          recipientUserId: null,
          recipientRole: 'admin',
          readReceipts: { 'user-1': '2024-03-09T13:00:00.000Z' },
        }),
      ]);

      const [item] = (
        await service.getForViewer({ userId: 'user-1', role: 'admin' })
      ).notifications;

      expect(item.is_read).toBe(true);
    });

    it('leaves a role broadcast unread for a viewer with no receipt', async () => {
      const { service } = build([
        notification({
          recipientUserId: null,
          recipientRole: 'admin',
          readReceipts: { 'user-2': '2024-03-09T13:00:00.000Z' },
        }),
      ]);

      const [item] = (
        await service.getForViewer({ userId: 'user-1', role: 'admin' })
      ).notifications;

      expect(item).toMatchObject({ is_read: false, read_at: null });
    });
  });
});

describe('markAsRead / markAsUnread', () => {
  it('stamps readAt on a personal notification', async () => {
    const row = notification({ id: 'n1' });
    const { service } = build([row]);

    const result = await service.markAsRead('n1', { userId: 'user-1' });

    expect(row.readAt).toBeInstanceOf(Date);
    expect(result.is_read).toBe(true);
  });

  it('records a per-viewer receipt on a role broadcast without touching readAt', async () => {
    const row = notification({
      id: 'n1',
      recipientUserId: null,
      recipientRole: 'admin',
    });
    const { service } = build([row]);

    await service.markAsRead('n1', { userId: 'user-1', role: 'admin' });

    expect(row.readAt).toBeNull();
    expect(row.readReceipts).toEqual({ 'user-1': expect.any(String) });
  });

  it('clears readAt when a personal notification is marked unread', async () => {
    const row = notification({ id: 'n1', readAt: new Date() });
    const { service } = build([row]);

    const result = await service.markAsUnread('n1', { userId: 'user-1' });

    expect(row.readAt).toBeNull();
    expect(result.is_read).toBe(false);
  });

  it('removes only this viewer’s receipt from a role broadcast', async () => {
    const row = notification({
      id: 'n1',
      recipientUserId: null,
      recipientRole: 'admin',
      readReceipts: { 'user-1': 'x', 'user-2': 'y' },
    });
    const { service } = build([row]);

    await service.markAsUnread('n1', { userId: 'user-1', role: 'admin' });

    expect(row.readReceipts).toEqual({ 'user-2': 'y' });
  });

  it('refuses to touch a notification addressed to someone else', async () => {
    const { service } = build([notification({ id: 'n1', recipientUserId: 'user-9' })]);

    await expect(
      service.markAsRead('n1', { userId: 'user-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('treats a dismissed notification as gone', async () => {
    const { service } = build([
      notification({ id: 'n1', dismissals: { 'user-1': 'yesterday' } }),
    ]);

    await expect(
      service.markAsRead('n1', { userId: 'user-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('dismiss', () => {
  it('deletes a personal notification outright', async () => {
    const row = notification({ id: 'n1' });
    const { service, repo } = build([row]);

    await expect(service.dismiss('n1', { userId: 'user-1' })).resolves.toEqual({
      id: 'n1',
      dismissed: true,
    });
    expect(repo.remove).toHaveBeenCalledWith(row);
  });

  it('only hides a role broadcast, since other members still need it', async () => {
    const row = notification({
      id: 'n1',
      recipientUserId: null,
      recipientRole: 'admin',
    });
    const { service, repo } = build([row]);

    await service.dismiss('n1', { userId: 'user-1', role: 'admin' });

    expect(repo.remove).not.toHaveBeenCalled();
    expect(row.dismissals).toEqual({ 'user-1': expect.any(String) });
  });

  it('dismissMany skips ids that are already gone', async () => {
    const { service, repo } = build([notification({ id: 'n1' })]);

    await expect(
      service.dismissMany(['n1', 'missing'], { userId: 'user-1' }),
    ).resolves.toMatchObject({ notifications: expect.any(Array) });
    expect(repo.remove).toHaveBeenCalledTimes(1);
  });

  it('dismissMany propagates a failure that is not "not found"', async () => {
    const { service, repo } = build([notification({ id: 'n1' })]);
    repo.remove.mockRejectedValueOnce(new Error('connection lost'));

    await expect(
      service.dismissMany(['n1'], { userId: 'user-1' }),
    ).rejects.toThrow('connection lost');
  });

  it('dismissMany tolerates a null id list', async () => {
    const { service } = build();

    await expect(
      service.dismissMany(null as never, { userId: 'user-1' }),
    ).resolves.toMatchObject({ unread_count: 0 });
  });
});

describe('markAllAsRead', () => {
  it('marks every unread row and leaves already-read rows alone', async () => {
    const unread = notification({ id: 'n1' });
    const alreadyRead = notification({ id: 'n2', readAt: new Date('2024-01-01') });
    const { service, repo } = build([unread, alreadyRead]);

    await service.markAllAsRead({ userId: 'user-1' });

    expect(unread.readAt).toBeInstanceOf(Date);
    expect(alreadyRead.readAt).toEqual(new Date('2024-01-01'));
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});

describe('handleNotificationEvent', () => {
  it('ignores a null payload', async () => {
    const { service } = build();

    await expect(service.handleNotificationEvent(null)).resolves.toBeNull();
  });

  it('ignores a payload with neither a user nor a role to deliver to', async () => {
    const { service } = build();

    await expect(
      service.handleNotificationEvent({ type: 'system' }),
    ).resolves.toBeNull();
  });

  it('resolves the recipient from a GitHub contributor login', async () => {
    const { service, developerService } = build();
    developerService.send.mockReturnValueOnce(of({ developer_id: 'dev-7' }) as never);

    const [created] = (await service.handleNotificationEvent({
      contributorLogin: 'octocat',
      type: 'learning_path_ready',
    })) as any[];

    expect(developerService.send).toHaveBeenCalledWith(
      'github_find_integration_by_username',
      { githubUsername: 'octocat' },
    );
    expect(created.recipient_user_id).toBe('dev-7');
  });

  it('accepts the camelCase developerId shape too', async () => {
    const { service, developerService } = build();
    developerService.send.mockReturnValueOnce(of({ developerId: 'dev-8' }) as never);

    const [created] = (await service.handleNotificationEvent({
      contributorLogin: 'octocat',
    })) as any[];

    expect(created.recipient_user_id).toBe('dev-8');
  });

  it('falls back to developerId when the lookup fails', async () => {
    const { service, developerService } = build();
    developerService.send.mockReturnValueOnce(
      throwError(() => new Error('developer-service down')) as never,
    );

    const [created] = (await service.handleNotificationEvent({
      contributorLogin: 'octocat',
      developerId: 'dev-fallback',
    })) as any[];

    expect(created.recipient_user_id).toBe('dev-fallback');
  });

  it('skips the lookup entirely when no contributor login is present', async () => {
    const { service, developerService } = build();

    await service.handleNotificationEvent({ developerId: 'dev-1' });

    expect(developerService.send).not.toHaveBeenCalled();
  });

  it('derives a title and deep link for a learning_path_ready event', async () => {
    const { service } = build();

    const [created] = (await service.handleNotificationEvent({
      developerId: 'dev-1',
      type: 'learning_path_ready',
    })) as any[];

    expect(created).toMatchObject({
      title: 'Recommendation ready',
      link: '/dashboard/developer/recommendations',
    });
  });

  it('uses a generic title and no link for an unknown event type', async () => {
    const { service } = build();

    const [created] = (await service.handleNotificationEvent({
      developerId: 'dev-1',
      type: 'something_else',
    })) as any[];

    expect(created).toMatchObject({ title: 'New notification', link: null });
  });

  it('prefers an explicit link and summary from the payload', async () => {
    const { service } = build();

    const [created] = (await service.handleNotificationEvent({
      developerId: 'dev-1',
      type: 'learning_path_ready',
      link: '/custom',
      summary: 'Your path is ready',
    })) as any[];

    expect(created).toMatchObject({
      link: '/custom',
      message: 'Your path is ready',
    });
  });

  it('keeps the raw event as metadata for the client to use', async () => {
    const { service } = build();
    const payload = { developerId: 'dev-1', repoName: 'devlab/platform' };

    const [created] = (await service.handleNotificationEvent(payload)) as any[];

    expect(created.metadata).toEqual(payload);
  });
});
