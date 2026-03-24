// api-gateway/src/github/github.controller.ts
import { Controller, Get, Post, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GitHubService } from './github.service';
import { AuthGuard } from '@nestjs/passport';
import { LinkGitHubDto } from './dto/link-github.dto';
import { SyncRepositoriesDto } from './dto/sync-repos.dto';
import { AnalyzeRepositoryDto } from './dto/analyze-repo.dto';

@ApiTags('GitHub Integration')
@Controller('github')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class GitHubController {
  constructor(private readonly gitHubService: GitHubService) {}

  @Get('integration')
  @ApiOperation({ summary: 'Get GitHub integration details' })
  @ApiResponse({ status: 200, description: 'Returns GitHub integration' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async getIntegration(@Request() req) {
    return this.gitHubService.getIntegration(req.user.id);
  }

  @Post('integration')
  @ApiOperation({ summary: 'Link GitHub account' })
  @ApiResponse({ status: 201, description: 'GitHub account linked successfully' })
  @ApiResponse({ status: 400, description: 'Invalid GitHub credentials' })
  async linkGitHub(@Request() req, @Body() linkGitHubDto: LinkGitHubDto) {
    return this.gitHubService.linkGitHub(req.user.id, linkGitHubDto);
  }

  @Delete('integration')
  @ApiOperation({ summary: 'Unlink GitHub account' })
  @ApiResponse({ status: 200, description: 'GitHub account unlinked successfully' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async unlinkGitHub(@Request() req) {
    return this.gitHubService.unlinkGitHub(req.user.id);
  }

  @Get('repositories')
  @ApiOperation({ summary: 'Get synced repositories' })
  @ApiResponse({ status: 200, description: 'Returns list of repositories' })
  async getRepositories(@Request() req) {
    return this.gitHubService.getRepositories(req.user.id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync repositories from GitHub' })
  @ApiResponse({ status: 200, description: 'Repositories synced successfully' })
  async syncRepositories(@Request() req, @Body() syncDto: SyncRepositoriesDto) {
    return this.gitHubService.syncRepositories(req.user.id, syncDto);
  }

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze a repository (placeholder)' })
  @ApiResponse({ status: 200, description: 'Analysis started' })
  async analyzeRepository(@Request() req, @Body() analyzeDto: AnalyzeRepositoryDto) {
    return this.gitHubService.analyzeRepository(req.user.id, analyzeDto);
  }
}