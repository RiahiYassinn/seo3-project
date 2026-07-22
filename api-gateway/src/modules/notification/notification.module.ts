import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationStreamService } from './notification-stream.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationStreamService],
})
export class NotificationModule {}
