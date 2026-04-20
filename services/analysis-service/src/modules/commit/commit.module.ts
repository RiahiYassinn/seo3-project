import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CommitAnalysisController } from './commit.controller';
import { CommitAnalysisService } from './commit.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'analysis-service-producer',
            brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
          },
          producer: {
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
  ],
  controllers: [CommitAnalysisController],
  providers: [CommitAnalysisService],
})
export class CommitModule {}
