import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GitHubService } from './github.service';
import { GitHubController } from './github.controller';
import { GitHubIntegration } from './entities/github-integration.entity';
import { Repository } from './entities/repository.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GitHubIntegration, Repository])],
  controllers: [GitHubController],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}