import { Controller, Post, Body, Headers } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('github')
  async handleGithubWebhook(
    @Body() payload: any,
    @Headers('x-github-event') event: string,
  ) {
    return this.webhookService.processGithubWebhook(event, payload);
  }

  @Post('gitlab')
  async handleGitlabWebhook(
    @Body() payload: any,
    @Headers('x-gitlab-event') event: string,
  ) {
    return this.webhookService.processGitlabWebhook(event, payload);
  }
}
