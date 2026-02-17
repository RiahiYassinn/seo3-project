import { Injectable } from '@nestjs/common';

@Injectable()
export class WebhookService {
  async processGithubWebhook(event: string, payload: any) {
    console.log(`Processing GitHub ${event} event`);
    
    // TODO: Implement webhook processing logic
    // - Parse commit data
    // - Send to Kafka (commit.analysis topic)
    // - Trigger NLP analysis
    
    return { status: 'received', event };
  }

  async processGitlabWebhook(event: string, payload: any) {
    console.log(`Processing GitLab ${event} event`);
    
    // TODO: Implement webhook processing logic
    
    return { status: 'received', event };
  }
}
