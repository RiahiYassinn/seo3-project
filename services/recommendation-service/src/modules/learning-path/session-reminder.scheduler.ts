import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RecommendationService } from './recommendation.service';

/**
 * Polls for mentoring sessions about to start and fires the reminder emails.
 *
 * A poll loop (rather than a per-session timer) survives restarts: state lives
 * in `mentorship_session_reminder_sent_at`, so nothing is lost or duplicated if
 * the service goes down between scheduling and the session.
 *
 * SESSION_REMINDER_LEAD_MINUTES  how far ahead to remind (default 15)
 * SESSION_REMINDER_POLL_SECONDS  how often to check (default 60)
 */
@Injectable()
export class SessionReminderScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionReminderScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  private readonly leadMinutes = Number(
    process.env.SESSION_REMINDER_LEAD_MINUTES || 15,
  );
  private readonly pollSeconds = Number(
    process.env.SESSION_REMINDER_POLL_SECONDS || 60,
  );

  constructor(private readonly recommendationService: RecommendationService) {}

  onModuleInit() {
    if (process.env.SESSION_REMINDERS_ENABLED === 'false') {
      this.logger.log('Session reminders are disabled');
      return;
    }

    this.timer = setInterval(() => this.tick(), this.pollSeconds * 1000);
    // Do not hold the process open just for the reminder loop.
    this.timer.unref?.();

    this.logger.log(
      `Session reminders active: ${this.leadMinutes} minutes ahead, polling every ${this.pollSeconds}s`,
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Skips overlapping runs so a slow SMTP server cannot stack up ticks. */
  private async tick() {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      await this.recommendationService.dispatchDueSessionReminders(
        this.leadMinutes,
      );
    } catch (error) {
      this.logger.error(
        `Reminder sweep failed: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      this.running = false;
    }
  }
}
