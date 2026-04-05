import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CommitAnalysisService } from './commit.service';

@Controller()
export class CommitAnalysisController {
  private readonly logger = new Logger(CommitAnalysisController.name);

  constructor(private readonly commitAnalysisService: CommitAnalysisService) {}

  @EventPattern('analysis.requested')
  async handleAnalysisRequested(@Payload() payload: any) {
    const message = this.unwrapPayload(payload);
    if (!message) {
      this.logger.warn('Received empty analysis.requested payload');
      return;
    }

    await this.commitAnalysisService.queueRepositoryAnalysis(message);
  }

  private unwrapPayload(payload: any) {
    const rawValue = payload?.value ?? payload;
    if (!rawValue) {
      return null;
    }

    if (typeof rawValue === 'string') {
      return JSON.parse(rawValue);
    }

    if (Buffer.isBuffer(rawValue)) {
      return JSON.parse(rawValue.toString('utf8'));
    }

    return rawValue;
  }
}
