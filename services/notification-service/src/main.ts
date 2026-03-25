import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'notification-service',
        brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
      },
      consumer: {
        groupId: 'notification-service-group',
      },
    },
  });

  await app.startAllMicroservices();
  
  // Parse URL to get port (format: tcp://host:port)
  const serviceUrl = process.env.NOTIFICATION_SERVICE_URL || 'tcp://localhost:3005';
  const port = parseInt(serviceUrl.split(':')[2]) || 3005;
  
  await app.listen(port);
  
  console.log(`Notification Service is running on: http://localhost:${port}`);
}

bootstrap();