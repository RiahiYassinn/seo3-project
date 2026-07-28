import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationService } from './notification.service';
import {
  NotificationCreatedPayload,
  NotificationStreamService,
} from './notification-stream.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationStreamService: NotificationStreamService,
  ) {}

  @Sse('stream')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Realtime notification stream (SSE)' })
  stream(@Req() req: any): Observable<MessageEvent> {
    return this.notificationStreamService.streamFor(req.user.id, req.user.role);
  }

  @EventPattern('notification.created')
  handleNotificationCreated(@Payload() message: any) {
    const payload = this.unwrapPayload(message);
    if (payload) {
      this.notificationStreamService.publish(payload as NotificationCreatedPayload);
    }
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

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user notifications' })
  getMyNotifications(@Req() req: any, @Query('limit') limit?: string) {
    return this.notificationService.getMyNotifications(
      req.user.id,
      req.user.role,
      Number(limit) || 50,
    );
  }

  @Post('send')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send notification' })
  sendNotification(@Req() req: any, @Body() notificationDto: CreateNotificationDto) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admins can send notifications');
    }

    return this.notificationService.sendNotification(notificationDto);
  }

  @Post(':id/read')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationService.markAsRead(
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Post(':id/unread')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as unread' })
  markAsUnread(@Req() req: any, @Param('id') id: string) {
    return this.notificationService.markAsUnread(id, req.user.id, req.user.role);
  }

  @Post('read-all')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all current user notifications as read' })
  markAllAsRead(@Req() req: any) {
    return this.notificationService.markAllAsRead(req.user.id, req.user.role);
  }

  @Post('bulk-delete')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete several notifications for the current user' })
  bulkDelete(@Req() req: any, @Body() body: { ids?: string[] }) {
    return this.notificationService.dismissMany(
      body?.ids || [],
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a notification for the current user' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.notificationService.dismiss(id, req.user.id, req.user.role);
  }
}
