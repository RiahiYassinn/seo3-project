import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { GithubService } from './github.service';
import { AuthGuard } from '@nestjs/passport';

// The JWT guard populates req.user with user data including req.user.id
@UseGuards(AuthGuard('jwt'))
@Controller('github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('integration')
  getIntegration(@Req() req: any) {
    return this.githubService.getIntegration(req.user.id);
  }

  @Post('integration')
  @HttpCode(HttpStatus.CREATED)
  linkGithub(@Req() req: any, @Body() body: any) {
    return this.githubService.linkGithub(req.user.id, body);
  }

  @Delete('integration')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkGithub(@Req() req: any) {
    return this.githubService.unlinkGithub(req.user.id);
  }

  @Get('repositories')
  getRepositories(@Req() req: any) {
    return this.githubService.getRepositories(req.user.id);
  }

  @Post('sync')
  syncRepositories(@Req() req: any) {
    return this.githubService.syncRepositories(req.user.id);
  }

  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  triggerAnalysis(@Req() req: any, @Body() body: any) {
    return this.githubService.triggerAnalysis(req.user.id, body.repository_id);
  }
}