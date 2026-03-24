import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'analysis-service',
        brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
      },
      consumer: {
        groupId: 'analysis-service-group',
      },
    },
  });

  await app.startAllMicroservices();
  
  const port = process.env.ANALYSIS_SERVICE_PORT || 3003;
  await app.listen(port);
  
  console.log(`Analysis Service is running on: http://localhost:${port}`);
}

bootstrap();
