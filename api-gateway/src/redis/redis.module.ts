// apps/api-gateway/src/redis/redis.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';

@Global() // Make Redis service available globally
@Module({
  imports: [ConfigModule],
  providers: [RedisService],
  exports: [RedisService], // Export so other modules can use it
})
export class RedisModule {}