import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GitHubController } from './github.controller';
import { GitHubService } from './github.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'DEVELOPER_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.DEVELOPER_SERVICE_HOST || 'localhost',
          port: parseInt(process.env.DEVELOPER_SERVICE_PORT) || 3001,
        },
      },
    ]),
  ],
  controllers: [GitHubController],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}