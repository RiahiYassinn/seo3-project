import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';

export interface NotificationCreatedPayload {
  id: string;
  recipient_user_id: string | null;
  recipient_role: string | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  priority: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

const PING_INTERVAL_MS = 20000;

@Injectable()
export class NotificationStreamService {
  private readonly events$ = new Subject<NotificationCreatedPayload>();

  publish(payload: NotificationCreatedPayload) {
    this.events$.next(payload);
  }

  streamFor(userId: string, role?: string): Observable<MessageEvent> {
    const normalizedRole = this.normalizeRole(role);

    const notifications$ = new Observable<MessageEvent>((subscriber) => {
      const subscription = this.events$.subscribe((payload) => {
        if (
          payload.recipient_user_id === userId ||
          (normalizedRole && payload.recipient_role === normalizedRole)
        ) {
          subscriber.next({ type: 'notification', data: payload });
        }
      });

      return () => subscription.unsubscribe();
    });

    const pings$ = interval(PING_INTERVAL_MS).pipe(
      map(() => ({ type: 'ping', data: {} }) as MessageEvent),
    );

    return merge(notifications$, pings$);
  }

  private normalizeRole(role?: string | null) {
    return String(role || '')
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');
  }
}
