import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('user/:userId')
  async getNotifications(
    @Param('userId') userId: string,
    @Query('role') role?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.getForViewer(
      { userId, role },
      Number(limit) || 50,
    );
  }

  @Post('send')
  async sendNotification(@Body() notificationDto: CreateNotificationDto) {
    const notifications = await this.notificationService.create(notificationDto);
    return { status: 'sent', notifications };
  }

  @Post(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Body() body: { userId: string; role?: string },
  ) {
    return this.notificationService.markAsRead(id, {
      userId: body.userId,
      role: body.role,
    });
  }

  @Post(':id/unread')
  async markAsUnread(
    @Param('id') id: string,
    @Body() body: { userId: string; role?: string },
  ) {
    return this.notificationService.markAsUnread(id, {
      userId: body.userId,
      role: body.role,
    });
  }

  @Post(':id/dismiss')
  async dismiss(
    @Param('id') id: string,
    @Body() body: { userId: string; role?: string },
  ) {
    return this.notificationService.dismiss(id, {
      userId: body.userId,
      role: body.role,
    });
  }

  @Post('dismiss')
  async dismissMany(
    @Body() body: { userId: string; role?: string; ids: string[] },
  ) {
    return this.notificationService.dismissMany(body.ids || [], {
      userId: body.userId,
      role: body.role,
    });
  }

  @Post('read-all')
  async markAllAsRead(@Body() body: { userId: string; role?: string }) {
    return this.notificationService.markAllAsRead({
      userId: body.userId,
      role: body.role,
    });
  }

  @EventPattern('notification.sent')
  async handleNotificationSent(@Payload() message: any) {
    return this.notificationService.handleNotificationEvent(
      this.unwrapPayload(message),
    );
  }

  private unwrapPayload(payload: any) {
    const rawValue = payload?.value ?? payload;
    if (!rawValue) {
      return null;
    }

    if (typeof rawValue === 'string') {
      return JSON.parse(rawValue);
    }

    if (Buffer.isBuffer(rawValue)) {
      return JSON.parse(rawValue.toString('utf8'));
    }

    return rawValue;
  }
}
