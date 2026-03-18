import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GitHubService } from './github.service';
import { LinkGitHubDto } from './dto/link-github.dto';
import { SyncReposDto } from './dto/sync-repos.dto';
import { AnalyzeRepoDto } from './dto/analyze-repo.dto';

@ApiTags('github')
@Controller('github')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class GitHubController {
  constructor(private readonly githubService: GitHubService) {}

  @Get('integration')
  @ApiOperation({ summary: 'Get GitHub integration status' })
  @ApiResponse({ status: 200, description: 'Integration found' })
  @ApiResponse({ status: 404, description: 'No integration found' })
  async getIntegration(@Request() req: any) {
    return this.githubService.getIntegration(req.user.id);
  }

  @Post('integration')
  @ApiOperation({ summary: 'Link GitHub account' })
  @ApiResponse({ status: 201, description: 'GitHub account linked successfully' })
  @ApiResponse({ status: 400, description: 'Invalid credentials or account already linked' })
  async linkGitHub(@Request() req: any, @Body() linkGitHubDto: LinkGitHubDto) {
    return this.githubService.linkGitHub(req.user.id, linkGitHubDto);
  }

  @Delete('integration')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink GitHub account' })
  @ApiResponse({ status: 200, description: 'GitHub account unlinked successfully' })
  @ApiResponse({ status: 404, description: 'No integration found' })
  async unlinkGitHub(@Request() req: any) {
    return this.githubService.unlinkGitHub(req.user.id);
  }

  @Get('repositories')
  @ApiOperation({ summary: 'Get synced repositories' })
  @ApiResponse({ status: 200, description: 'List of repositories' })
  async getRepositories(@Request() req: any) {
    return this.githubService.getRepositories(req.user.id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync repositories from GitHub' })
  @ApiResponse({ status: 200, description: 'Repositories synced successfully' })
  @ApiResponse({ status: 404, description: 'No integration found' })
  async syncRepositories(@Request() req: any, @Body() syncReposDto: SyncReposDto) {
    return this.githubService.syncRepositories(req.user.id, syncReposDto);
  }

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze a repository with NLP' })
  @ApiResponse({ status: 200, description: 'Analysis started' })
  @ApiResponse({ status: 404, description: 'Repository not found' })
  async analyzeRepository(@Request() req: any, @Body() analyzeRepoDto: AnalyzeRepoDto) {
    return this.githubService.analyzeRepository(req.user.id, analyzeRepoDto.repository_id);
  }
}
