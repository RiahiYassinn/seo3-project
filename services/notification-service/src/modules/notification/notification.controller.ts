import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller('notifications')
export class NotificationController {
  @Get(':developerId')
  async getNotifications(@Param('developerId') developerId: string) {
    // TODO: Fetch notifications from database
    return { message: `Get notifications for developer ${developerId}` };
  }

  @Post('send')
  async sendNotification(@Body() notificationDto: any) {
    // TODO: Send notification via appropriate channel
    return { status: 'sent' };
  }

  @MessagePattern('notification.sent')
  async handleNotificationSent(@Payload() message: any) {
    console.log('Notification sent event:', message);
  }
}
