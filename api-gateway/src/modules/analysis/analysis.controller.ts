import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('analysis')
@Controller('analysis')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class AnalysisController {
  @Post('webhook/github')
  @ApiOperation({ summary: 'GitHub webhook handler' })
  handleGithubWebhook(@Body() _payload: any) {
    return { message: 'GitHub webhook received - proxied to Analysis Service' };
  }

  @Post('webhook/gitlab')
  @ApiOperation({ summary: 'GitLab webhook handler' })
  handleGitlabWebhook(@Body() _payload: any) {
    return { message: 'GitLab webhook received - proxied to Analysis Service' };
  }

  @Get('commits/:developerId')
  @ApiOperation({ summary: 'Get developer commits analysis' })
  getCommitAnalysis(@Param('developerId') developerId: string) {
    return { message: `Get commit analysis for developer ${developerId} - proxied to Analysis Service` };
  }

  @Get('pull-requests/:developerId')
  @ApiOperation({ summary: 'Get developer PR analysis' })
  getPRAnalysis(@Param('developerId') developerId: string) {
    return { message: `Get PR analysis for developer ${developerId} - proxied to Analysis Service` };
  }
}
