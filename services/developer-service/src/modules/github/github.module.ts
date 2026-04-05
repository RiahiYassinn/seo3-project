import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { GithubController } from './github.controller';
import { GithubService } from './github.service';
import { GithubIntegration } from './entities/github-integration.entity';
import { Repository } from './entities/repository.entity';
import { GithubAnalysisResultConsumer } from './github-analysis-result.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([GithubIntegration, Repository]),
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'developer-service',
            brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
          },
          producer: {
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
  ],
  controllers: [GithubController, GithubAnalysisResultConsumer],
  providers: [GithubService],
})
export class GithubModule {}
