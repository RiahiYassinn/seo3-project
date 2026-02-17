import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class NotificationController {
  @Get(':developerId')
  @ApiOperation({ summary: 'Get developer notifications' })
  getNotifications(@Param('developerId') developerId: string) {
    return { message: `Get notifications for developer ${developerId} - proxied to Notification Service` };
  }

  @Post('send')
  @ApiOperation({ summary: 'Send notification' })
  sendNotification(@Body() notificationDto: any) {
    return { message: 'Send notification - proxied to Notification Service' };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@Param('id') id: string) {
    return { message: `Mark notification ${id} as read - proxied to Notification Service` };
  }
}
