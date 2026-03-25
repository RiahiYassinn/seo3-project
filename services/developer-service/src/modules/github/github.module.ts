import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { GithubController } from './github.controller';
import { GithubService } from './github.service';
import { GithubIntegration } from './entities/github-integration.entity';
import { Repository } from './entities/repository.entity';

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
            brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
          },
          producer: {
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
  ],
  controllers: [GithubController],
  providers: [GithubService],
})
export class GithubModule {}