import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { GithubService } from './github.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

// The JWT guard populates req.user with user data including req.user.id
@ApiTags('github')
@UseGuards(AuthGuard('jwt'))
@Controller('github')
@ApiBearerAuth()
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('integration')
  @ApiOperation({ summary: 'Get GitHub integration for the current user' })
  getIntegration(@Req() req: any) {
    return this.githubService.getIntegration(req.user.id);
  }

  @Post('integration')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link a GitHub account' })
  linkGithub(@Req() req: any, @Body() body: any) {
    return this.githubService.linkGithub(req.user.id, body);
  }

  @Delete('integration')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink the current GitHub account' })
  unlinkGithub(@Req() req: any) {
    return this.githubService.unlinkGithub(req.user.id);
  }

  @Get('repositories')
  @ApiOperation({ summary: 'List synced repositories for the current user' })
  getRepositories(@Req() req: any) {
    return this.githubService.getRepositories(req.user.id);
  }

  @Get('repositories/:repositoryId')
  @ApiOperation({ summary: 'Get a single synced repository for the current user' })
  getRepository(@Req() req: any, @Param('repositoryId') repositoryId: string) {
    return this.githubService.getRepository(req.user.id, repositoryId);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync repositories from GitHub' })
  syncRepositories(@Req() req: any) {
    return this.githubService.syncRepositories(req.user.id);
  }

  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger repository analysis' })
  triggerAnalysis(@Req() req: any, @Body() body: any) {
    return this.githubService.triggerAnalysis(req.user.id, body.repository_id);
  }
}
