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
import { GithubProxyService } from './github.proxy.service';
import { AuthGuard } from '@nestjs/passport'; 

// The JWT guard must populate req.user.sub = developerId
@UseGuards(AuthGuard('jwt'))
@Controller('github')
export class GithubController {
  constructor(private readonly proxy: GithubProxyService) {}

  @Get('integration')
  getIntegration(@Req() req: any) {
    return this.proxy.forward('get', 'integration', req.user.sub);
  }

  @Post('integration')
  @HttpCode(HttpStatus.CREATED)
  linkGithub(@Req() req: any, @Body() body: any) {
    return this.proxy.forward('post', 'integration', req.user.sub, body);
  }

  @Delete('integration')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkGithub(@Req() req: any) {
    return this.proxy.forward('delete', 'integration', req.user.sub);
  }

  @Get('repositories')
  getRepositories(@Req() req: any) {
    return this.proxy.forward('get', 'repositories', req.user.sub);
  }

  @Post('sync')
  syncRepositories(@Req() req: any, @Body() body: any) {
    return this.proxy.forward('post', 'sync', req.user.sub, body);
  }

  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  triggerAnalysis(@Req() req: any, @Body() body: any) {
    return this.proxy.forward('post', 'analyze', req.user.sub, body);
  }
}