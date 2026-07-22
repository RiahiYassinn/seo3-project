import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClientKafka, ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './entities/notification.entity';

type Viewer = {
  userId: string;
  role?: string;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @Inject('DEVELOPER_SERVICE')
    private readonly developerService: ClientProxy,
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async getForViewer(viewer: Viewer, limit = 50) {
    const where: FindOptionsWhere<Notification>[] = [
      { recipientUserId: viewer.userId },
    ];

    if (viewer.role) {
      where.push({ recipientRole: this.normalizeRole(viewer.role) });
    }

    const notifications = await this.notificationRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(Number(limit) || 50, 100)),
    });

    const mapped = notifications.map((notification) =>
      this.mapForViewer(notification, viewer.userId),
    );

    return {
      notifications: mapped,
      unread_count: mapped.filter((notification) => !notification.is_read).length,
    };
  }

  async create(dto: CreateNotificationDto) {
    const recipients = this.resolveRecipients(dto);
    const notifications = recipients.map((recipient) =>
      this.notificationRepo.create({
        recipientUserId: recipient.userId,
        recipientRole: recipient.role,
        type: dto.type || 'system',
        title: dto.title.trim(),
        message: dto.message.trim(),
        link: dto.link?.trim() || null,
        priority: dto.priority || 'info',
        metadata: dto.metadata || {},
        readAt: null,
        readReceipts: {},
      }),
    );

    const saved = await this.notificationRepo.save(notifications);
    const mapped = saved.map((notification) => this.map(notification));

    for (const notification of mapped) {
      this.kafkaClient.emit('notification.created', {
        key: notification.recipient_user_id || notification.recipient_role || notification.id,
        value: JSON.stringify({ ...notification, is_read: false }),
      });
    }

    return mapped;
  }

  async markAsRead(notificationId: string, viewer: Viewer) {
    const notification = await this.findVisibleNotification(notificationId, viewer);
    const now = new Date();

    if (notification.recipientUserId) {
      notification.readAt = now;
    } else {
      notification.readReceipts = {
        ...(notification.readReceipts || {}),
        [viewer.userId]: now.toISOString(),
      };
    }

    const saved = await this.notificationRepo.save(notification);
    return this.mapForViewer(saved, viewer.userId);
  }

  async markAllAsRead(viewer: Viewer) {
    const payload = await this.getForViewer(viewer, 100);
    const unreadIds = payload.notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    for (const notificationId of unreadIds) {
      await this.markAsRead(notificationId, viewer);
    }

    return this.getForViewer(viewer, 100);
  }

  async handleNotificationEvent(payload: Record<string, any> | null) {
    if (!payload) {
      return null;
    }

    const developerId =
      (await this.resolveDeveloperIdFromContributor(payload?.contributorLogin)) ||
      payload?.developerId ||
      payload?.recipientUserId;
    const recipientRole = payload?.recipientRole;

    if (!developerId && !recipientRole) {
      return null;
    }

    const dto: CreateNotificationDto = {
      recipientUserId: developerId,
      recipientRole,
      type: payload?.type || 'system',
      title: payload?.title || this.titleForType(payload?.type),
      message:
        payload?.summary ||
        payload?.message ||
        'A new platform notification is available.',
      link: this.linkForEvent(payload),
      priority: payload?.priority || 'info',
      metadata: payload,
    };

    return this.create(dto);
  }

  private resolveRecipients(dto: CreateNotificationDto) {
    const recipients: Array<{ userId: string | null; role: string | null }> = [];

    if (dto.recipientUserId) {
      recipients.push({ userId: dto.recipientUserId, role: null });
    }

    for (const userId of dto.recipientUserIds || []) {
      recipients.push({ userId, role: null });
    }

    if (dto.recipientRole) {
      recipients.push({
        userId: null,
        role: this.normalizeRole(dto.recipientRole),
      });
    }

    if (recipients.length === 0) {
      throw new BadRequestException(
        'Provide recipientUserId, recipientUserIds, or recipientRole',
      );
    }

    if (!dto.title?.trim() || !dto.message?.trim()) {
      throw new BadRequestException('Notification title and message are required');
    }

    return recipients;
  }

  private async findVisibleNotification(notificationId: string, viewer: Viewer) {
    const where: FindOptionsWhere<Notification>[] = [
      { id: notificationId, recipientUserId: viewer.userId },
    ];

    if (viewer.role) {
      where.push({
        id: notificationId,
        recipientRole: this.normalizeRole(viewer.role),
      });
    }

    const notification = await this.notificationRepo.findOne({ where });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  private mapForViewer(notification: Notification, userId: string) {
    const roleReadAt = notification.readReceipts?.[userId] || null;
    const readAt = notification.recipientUserId
      ? notification.readAt?.toISOString() || null
      : roleReadAt;

    return {
      ...this.map(notification),
      is_read: Boolean(readAt),
      read_at: readAt,
    };
  }

  private map(notification: Notification) {
    return {
      id: notification.id,
      recipient_user_id: notification.recipientUserId,
      recipient_role: notification.recipientRole,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      priority: notification.priority,
      metadata: notification.metadata || {},
      read_at: notification.readAt?.toISOString() || null,
      created_at: notification.createdAt,
      updated_at: notification.updatedAt,
    };
  }

  private normalizeRole(role?: string | null) {
    return String(role || '')
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');
  }

  private titleForType(type?: string) {
    if (type === 'learning_path_ready') {
      return 'Recommendation ready';
    }

    return 'New notification';
  }

  private linkForEvent(payload: Record<string, any>) {
    if (payload?.link) {
      return payload.link;
    }

    if (payload?.type === 'learning_path_ready') {
      return '/dashboard/developer/recommendations';
    }

    return null;
  }

  private async resolveDeveloperIdFromContributor(contributorLogin?: string | null) {
    const normalizedLogin = String(contributorLogin || '').trim();
    if (!normalizedLogin) {
      return null;
    }

    try {
      const integration = await firstValueFrom(
        this.developerService.send('github_find_integration_by_username', {
          githubUsername: normalizedLogin,
        }),
      );

      return integration?.developer_id || integration?.developerId || null;
    } catch (error: any) {
      this.logger.warn(
        `Could not resolve notification recipient for @${normalizedLogin}: ${
          error?.message || error
        }`,
      );
      return null;
    }
  }
}
