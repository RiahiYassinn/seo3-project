import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { RecommendationConsumer } from './recommendation.consumer';
import { RecommendationCase } from './entities/recommendation-case.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecommendationCase]),
    ClientsModule.registerAsync([
      {
        name: 'DEVELOPER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get('DEVELOPER_SERVICE_HOST', 'localhost'),
            port: configService.get('DEVELOPER_SERVICE_PORT', 3001),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [RecommendationController, RecommendationConsumer],
  providers: [RecommendationService],
})
export class LearningPathModule {}
