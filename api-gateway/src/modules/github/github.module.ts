import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GithubController } from './github.controller';
import { GithubProxyService } from './github.proxy.service';

@Module({
  imports: [
HttpModule.register({
  baseURL: `${process.env.DEVELOPER_SERVICE_HTTP_URL || 'http://localhost:3002'}/api/v1`,
  timeout: 15_000,
}),
  ],
  controllers: [GithubController],
  providers: [GithubProxyService],
})
export class GithubModule {}