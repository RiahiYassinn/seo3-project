// developer-service/src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const tcpApp = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: parseInt(process.env.DEVELOPER_SERVICE_PORT || '3001'),
      },
    },
  );

  const kafkaApp = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'developer-service-kafka',
          brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
        },
        consumer: {
          groupId: 'developer-service-group',
        },
      },
    },
  );

  await Promise.all([tcpApp.listen(), kafkaApp.listen()]);
  console.log(`Developer Service TCP microservice listening on port ${process.env.DEVELOPER_SERVICE_PORT || '3001'}`);
  console.log('Developer Service Kafka consumer listening for analysis result events');
}
bootstrap();
