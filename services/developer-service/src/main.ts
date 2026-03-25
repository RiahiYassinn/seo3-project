// developer-service/src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create pure TCP microservice
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: parseInt(process.env.DEVELOPER_SERVICE_PORT || '3001'),
      },
    },
  );

  await app.listen();
  console.log(`Developer Service TCP microservice listening on port ${process.env.DEVELOPER_SERVICE_PORT || '3001'}`);
}
bootstrap();