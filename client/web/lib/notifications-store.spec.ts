import type { AppNotification } from './notifications';

// The real module pulls in axios, lucide-react and an EventSource connection.
// A factory mock keeps the store under test and none of that transport.
jest.mock('./notifications', () => ({
  notificationsAPI: {
    list: jest.fn(),
    markRead: jest.fn(),
    markUnread: jest.fn(),
    markAllRead: jest.fn(),
    remove: jest.fn(),
    removeMany: jest.fn(),
  },
  subscribeToNotifications: jest.fn(() => jest.fn()),
}));

import { notificationsAPI, subscribeToNotifications } from './notifications';
import {
  connectNotificationStream,
  selectUnreadCount,
  useNotificationStore,
} from './notifications-store';

const api = notificationsAPI as jest.Mocked<typeof notificationsAPI>;
const subscribe = subscribeToNotifications as jest.MockedFunction<
  typeof subscribeToNotifications
>;

const notification = (
  overrides: Partial<AppNotification> = {},
): AppNotification =>
  ({
    id: 'n1',
    recipient_user_id: 'user-1',
    recipient_role: null,
    type: 'system',
    title: 'Title',
    message: 'Message',
    link: null,
    priority: 'info',
    metadata: {},
    is_read: false,
    read_at: null,
    created_at: '2024-03-09T12:00:00Z',
    updated_at: '2024-03-09T12:00:00Z',
    ...overrides,
  }) as AppNotification;

const seed = (notifications: AppNotification[]) =>
  useNotificationStore.setState({ notifications });

const state = () => useNotificationStore.getState();
const ids = () => state().notifications.map((item) => item.id);

beforeEach(() => {
  jest.clearAllMocks();
  useNotificationStore.setState({
    notifications: [],
    loading: false,
    initialized: false,
    busyIds: [],
    mutating: false,
    error: '',
  });
});

describe('load', () => {
  it('sorts the fetched list newest first', async () => {
    api.list.mockResolvedValue({
      notifications: [
        notification({ id: 'old', created_at: '2024-03-01T00:00:00Z' }),
        notification({ id: 'new', created_at: '2024-03-09T00:00:00Z' }),
        notification({ id: 'mid', created_at: '2024-03-05T00:00:00Z' }),
      ],
      unread_count: 3,
    });

    await state().load();

    expect(ids()).toEqual(['new', 'mid', 'old']);
  });

  it('marks the store initialized and clears loading', async () => {
    api.list.mockResolvedValue({ notifications: [], unread_count: 0 });

    await state().load();

    expect(state()).toMatchObject({ initialized: true, loading: false, error: '' });
  });

  it('tolerates a response with no notifications array', async () => {
    api.list.mockResolvedValue({ unread_count: 0 } as never);

    await state().load();

    expect(state().notifications).toEqual([]);
  });

  it('surfaces the server message on failure', async () => {
    api.list.mockRejectedValue({ response: { data: { message: 'Session expired' } } });

    await state().load();

    expect(state()).toMatchObject({ error: 'Session expired', loading: false });
  });

  it('falls back to a generic message when the error carries none', async () => {
    api.list.mockRejectedValue({});

    await state().load();

    expect(state().error).toBe('Unable to load notifications');
  });

  it('leaves the existing list in place when a refresh fails', async () => {
    seed([notification({ id: 'kept' })]);
    api.list.mockRejectedValue(new Error('offline'));

    await state().load();

    expect(ids()).toEqual(['kept']);
  });
});

describe('markRead', () => {
  it('updates the row before the request resolves', async () => {
    seed([notification({ id: 'n1' })]);
    api.markRead.mockImplementation(async () => {
      expect(state().notifications[0].is_read).toBe(true);
      return notification();
    });

    await state().markRead('n1');

    expect(api.markRead).toHaveBeenCalledWith('n1');
  });

  it('stamps read_at alongside the flag', async () => {
    seed([notification({ id: 'n1' })]);
    api.markRead.mockResolvedValue(notification());

    await state().markRead('n1');

    expect(state().notifications[0].read_at).toEqual(expect.any(String));
  });

  it('skips a row that is already read', async () => {
    seed([notification({ id: 'n1', is_read: true })]);

    await state().markRead('n1');

    expect(api.markRead).not.toHaveBeenCalled();
  });

  it('skips an id that is not in the store', async () => {
    seed([notification({ id: 'n1' })]);

    await state().markRead('ghost');

    expect(api.markRead).not.toHaveBeenCalled();
  });

  it('rolls the optimistic update back when the request fails', async () => {
    seed([notification({ id: 'n1' })]);
    api.markRead.mockRejectedValue({ message: 'Network down' });

    await state().markRead('n1');

    expect(state().notifications[0].is_read).toBe(false);
    expect(state().error).toBe('Network down');
  });
});

describe('markUnread', () => {
  it('clears the flag and the timestamp', async () => {
    seed([notification({ id: 'n1', is_read: true, read_at: '2024-03-09T13:00:00Z' })]);
    api.markUnread.mockResolvedValue(notification());

    await state().markUnread('n1');

    expect(state().notifications[0]).toMatchObject({
      is_read: false,
      read_at: null,
    });
  });

  it('skips a row that is already unread', async () => {
    seed([notification({ id: 'n1', is_read: false })]);

    await state().markUnread('n1');

    expect(api.markUnread).not.toHaveBeenCalled();
  });

  it('rolls back on failure', async () => {
    seed([notification({ id: 'n1', is_read: true })]);
    api.markUnread.mockRejectedValue(new Error('nope'));

    await state().markUnread('n1');

    expect(state().notifications[0].is_read).toBe(true);
  });
});

describe('markAllRead', () => {
  it('does nothing when every row is already read', async () => {
    seed([notification({ id: 'n1', is_read: true })]);

    await state().markAllRead();

    expect(api.markAllRead).not.toHaveBeenCalled();
  });

  it('marks the unread rows and adopts the server response', async () => {
    seed([notification({ id: 'n1' }), notification({ id: 'n2', is_read: true })]);
    api.markAllRead.mockResolvedValue({
      notifications: [notification({ id: 'n2', is_read: true })],
      unread_count: 0,
    });

    await state().markAllRead();

    expect(ids()).toEqual(['n2']);
    expect(state().mutating).toBe(false);
  });

  it('gives every newly-read row the same timestamp', async () => {
    seed([notification({ id: 'n1' }), notification({ id: 'n2' })]);
    let observed: Array<string | null> = [];
    api.markAllRead.mockImplementation(async () => {
      observed = state().notifications.map((item) => item.read_at);
      throw new Error('stop here');
    });

    await state().markAllRead();

    expect(observed[0]).toBe(observed[1]);
  });

  it('restores the previous list on failure and stops mutating', async () => {
    seed([notification({ id: 'n1' })]);
    api.markAllRead.mockRejectedValue(new Error('boom'));

    await state().markAllRead();

    expect(state().notifications[0].is_read).toBe(false);
    expect(state().mutating).toBe(false);
  });
});

describe('remove', () => {
  it('drops the row immediately and clears its busy flag afterwards', async () => {
    seed([notification({ id: 'n1' }), notification({ id: 'n2' })]);
    api.remove.mockImplementation(async () => {
      expect(state().busyIds).toContain('n1');
    });

    await state().remove('n1');

    expect(ids()).toEqual(['n2']);
    expect(state().busyIds).toEqual([]);
  });

  it('restores the row and clears the busy flag when the delete fails', async () => {
    seed([notification({ id: 'n1' })]);
    api.remove.mockRejectedValue({ response: { data: { message: 'Forbidden' } } });

    await state().remove('n1');

    expect(ids()).toEqual(['n1']);
    expect(state().busyIds).toEqual([]);
    expect(state().error).toBe('Forbidden');
  });
});

describe('removeMany', () => {
  it('short-circuits on an empty id list', async () => {
    await state().removeMany([]);

    expect(api.removeMany).not.toHaveBeenCalled();
    expect(state().mutating).toBe(false);
  });

  it('drops every selected row and adopts the server list', async () => {
    seed([
      notification({ id: 'n1' }),
      notification({ id: 'n2' }),
      notification({ id: 'n3' }),
    ]);
    api.removeMany.mockResolvedValue({
      notifications: [notification({ id: 'n3' })],
      unread_count: 1,
    });

    await state().removeMany(['n1', 'n2']);

    expect(ids()).toEqual(['n3']);
  });

  it('restores the full list on failure', async () => {
    seed([notification({ id: 'n1' }), notification({ id: 'n2' })]);
    api.removeMany.mockRejectedValue(new Error('boom'));

    await state().removeMany(['n1']);

    expect(ids()).toEqual(['n1', 'n2']);
    expect(state().mutating).toBe(false);
  });
});

describe('receive', () => {
  it('inserts a pushed notification in date order', () => {
    seed([
      notification({ id: 'old', created_at: '2024-03-01T00:00:00Z' }),
      notification({ id: 'new', created_at: '2024-03-09T00:00:00Z' }),
    ]);

    state().receive(notification({ id: 'mid', created_at: '2024-03-05T00:00:00Z' }));

    expect(ids()).toEqual(['new', 'mid', 'old']);
  });

  it('ignores a duplicate id, so a replayed SSE event is harmless', () => {
    seed([notification({ id: 'n1' })]);

    state().receive(notification({ id: 'n1', title: 'Changed' }));

    expect(state().notifications).toHaveLength(1);
    expect(state().notifications[0].title).toBe('Title');
  });
});

describe('selectors and resets', () => {
  it('selectUnreadCount counts only unread rows', () => {
    seed([
      notification({ id: 'n1' }),
      notification({ id: 'n2', is_read: true }),
      notification({ id: 'n3' }),
    ]);

    expect(selectUnreadCount(state())).toBe(2);
  });

  it('reset clears the list and the initialized flag', () => {
    seed([notification()]);
    useNotificationStore.setState({ initialized: true, error: 'x' });

    state().reset();

    expect(state()).toMatchObject({
      notifications: [],
      initialized: false,
      error: '',
    });
  });

  it('clearError leaves the list alone', () => {
    seed([notification()]);
    useNotificationStore.setState({ error: 'x' });

    state().clearError();

    expect(state().error).toBe('');
    expect(state().notifications).toHaveLength(1);
  });
});

describe('connectNotificationStream', () => {
  const timers = { setInterval: jest.fn(() => 7), clearInterval: jest.fn() };

  beforeAll(() => {
    (globalThis as any).window = timers;
  });

  afterAll(() => {
    delete (globalThis as any).window;
  });

  beforeEach(() => {
    timers.setInterval.mockClear();
    timers.clearInterval.mockClear();
  });

  it('opens exactly one stream no matter how many consumers mount', () => {
    const first = connectNotificationStream();
    const second = connectNotificationStream();

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(timers.setInterval).toHaveBeenCalledTimes(1);

    first();
    second();
  });

  it('keeps the stream open until the last consumer unmounts', () => {
    const unsubscribe = jest.fn();
    subscribe.mockReturnValueOnce(unsubscribe);

    const first = connectNotificationStream();
    const second = connectNotificationStream();

    first();
    expect(unsubscribe).not.toHaveBeenCalled();

    second();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(timers.clearInterval).toHaveBeenCalledWith(7);
  });

  it('routes a pushed notification into the store', () => {
    let push: ((item: AppNotification) => void) | undefined;
    subscribe.mockImplementationOnce((onNotification) => {
      push = onNotification;
      return jest.fn();
    });

    const disconnect = connectNotificationStream();
    push?.(notification({ id: 'pushed' }));

    expect(ids()).toContain('pushed');

    disconnect();
  });

  it('re-opens the stream after a full teardown', () => {
    connectNotificationStream()();

    expect(subscribe).toHaveBeenCalledTimes(1);

    connectNotificationStream()();

    expect(subscribe).toHaveBeenCalledTimes(2);
  });
});
