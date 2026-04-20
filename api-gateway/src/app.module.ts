import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthModule } from './modules/auth/auth.module';
import { DeveloperModule } from './modules/developer/developer.module';
import { SkillModule } from './modules/skill/skill.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { NotificationModule } from './modules/notification/notification.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';

import { GithubModule } from './modules/github/github.module';



@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.RATE_LIMIT_TTL) || 60,
      limit: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    }]),

    // Caching
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes
      max: 100, // maximum number of items in cache
    }),

    // Feature modules
    AuthModule,
    AdminModule,
    DeveloperModule,
    GithubModule,
    SkillModule,
    AnalysisModule,
    RecommendationModule,
    NotificationModule,
    HealthModule,
  ],
})
export class AppModule {}
