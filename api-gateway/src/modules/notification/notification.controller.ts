import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user notifications' })
  getMyNotifications(@Req() req: any, @Query('limit') limit?: string) {
    return this.notificationService.getMyNotifications(
      req.user.id,
      req.user.role,
      Number(limit) || 50,
    );
  }

  @Post('send')
  @ApiOperation({ summary: 'Send notification' })
  sendNotification(@Req() req: any, @Body() notificationDto: CreateNotificationDto) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admins can send notifications');
    }

    return this.notificationService.sendNotification(notificationDto);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationService.markAsRead(
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all current user notifications as read' })
  markAllAsRead(@Req() req: any) {
    return this.notificationService.markAllAsRead(req.user.id, req.user.role);
  }
}
