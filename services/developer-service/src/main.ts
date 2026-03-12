import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create HTTP application
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // TCP microservice for API Gateway communication (port distinct from HTTP)
  const tcpPort = parseInt(process.env.DEVELOPER_SERVICE_PORT) || 3001;
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: tcpPort,
    },
  });

  await app.startAllMicroservices();

  // HTTP server runs on a separate port to avoid conflict with TCP
  const httpPort = parseInt(process.env.DEVELOPER_SERVICE_HTTP_PORT) || 3011;
  await app.listen(httpPort);

  console.log(`Developer Service TCP microservice listening on port ${tcpPort}`);
  console.log(`Developer Service HTTP server running on: http://localhost:${httpPort}`);
}

bootstrap();
