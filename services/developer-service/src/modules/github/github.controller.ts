import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GithubService } from './github.service';
import { LinkGithubDto } from './dto/link-github.dto';
import { SyncReposDto } from './dto/sync-repos.dto';
import { AnalyzeRepoDto } from './dto/analyze-repo.dto';

// developerId is injected by the API Gateway via x-developer-id header
// and extracted in a middleware — see note below
@Controller('github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('integration')
  getIntegration(@Req() req: any) {
    return this.githubService.getIntegration(req.developerId);
  }

  @Post('integration')
  @HttpCode(HttpStatus.CREATED)
  linkGithub(@Req() req: any, @Body() dto: LinkGithubDto) {
    return this.githubService.linkGithub(req.developerId, dto);
  }

  @Delete('integration')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkGithub(@Req() req: any) {
    return this.githubService.unlinkGithub(req.developerId);
  }

  @Get('repositories')
  getRepositories(@Req() req: any) {
    return this.githubService.getRepositories(req.developerId);
  }

  @Post('sync')
  syncRepositories(@Req() req: any) {
    return this.githubService.syncRepositories(req.developerId);
  }

  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  triggerAnalysis(@Req() req: any, @Body() dto: AnalyzeRepoDto) {
    return this.githubService.triggerAnalysis(req.developerId, dto.repository_id);
  }
}