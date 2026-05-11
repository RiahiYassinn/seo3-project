import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventPattern, Payload } from '@nestjs/microservices';
import { RecommendationService } from './recommendation.service';

@Controller()
export class RecommendationConsumer {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly configService: ConfigService,
  ) {}

  @EventPattern('analysis.completed')
  async handleAnalysisCompleted(@Payload() payload: any) {
    const autoGenerateEnabled =
      String(
        this.configService.get<string>('AUTO_GENERATE_RECOMMENDATIONS') ||
          'false',
      ).toLowerCase() === 'true';

    if (!autoGenerateEnabled) {
      return;
    }

    const message = this.unwrapPayload(payload);
    if (
      !message?.repositoryId ||
      (!message?.summary && !Array.isArray(message?.detectedGaps))
    ) {
      return;
    }

    await this.recommendationService.processAnalysisCompleted(message);
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
