import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RecommendationController } from "./recommendation.controller";
import { RecommendationService } from "./recommendation.service";
import { RecommendationConsumer } from "./recommendation.consumer";
import { RecommendationCase } from "./entities/recommendation-case.entity";
import { MentorRequest } from "./entities/mentor-request.entity";
import { CourseCatalogService } from "./course-catalog.service";
import { LlmClientService } from "./llm-client.service";
import { RagLearningPathService } from "./rag-learning-path.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([RecommendationCase, MentorRequest]),
    ClientsModule.registerAsync([
      {
        name: "DEVELOPER_SERVICE",
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get("DEVELOPER_SERVICE_HOST", "localhost"),
            port: configService.get("DEVELOPER_SERVICE_PORT", 3001),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: "RECOMMENDATION_EVENTS_CLIENT",
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: "recommendation-service-producer",
              brokers: configService
                .get<string>("KAFKA_BROKERS", "localhost:29092")
                .split(","),
            },
            producer: {
              allowAutoTopicCreation: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [RecommendationController, RecommendationConsumer],
  providers: [
    RecommendationService,
    CourseCatalogService,
    LlmClientService,
    RagLearningPathService,
  ],
  exports: [CourseCatalogService],
})
export class LearningPathModule {}
