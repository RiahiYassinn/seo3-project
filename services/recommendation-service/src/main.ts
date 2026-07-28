import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { CourseCatalogService } from './modules/learning-path/course-catalog.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const [command, commandArg] = process.argv.slice(2);

  if (command === 'ingest:courses') {
    const courseCatalogService = app.get(CourseCatalogService);
    const result = await courseCatalogService.ingestFromFile(commandArg);
    await app.close();
    console.log(
      `Recommendation Service course ingestion complete: ${result.processed} records from ${result.path}`,
    );
    return;
  }

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: '-service',
        brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
      },
      consumer: {
        groupId: 'recommendation-service-group',
      },
    },
  });

  await app.startAllMicroservices();
  
  // Parse URL to get port (format: tcp://host:port)
  const serviceUrl = process.env.RECOMMENDATION_SERVICE_URL || 'tcp://localhost:3004';
  const port = parseInt(serviceUrl.split(':')[2]) || 3004;
  
  await app.listen(port);
  
  console.log(`Recommendation Service is running on: http://localhost:${port}`);
}

bootstrap();
