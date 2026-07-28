import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';

@Module({
  imports: [
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
  controllers: [GithubController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}