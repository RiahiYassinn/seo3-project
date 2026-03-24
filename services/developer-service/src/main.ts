import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Hybrid: handles both TCP (existing) and HTTP (GitHub)
  const app = await NestFactory.create(AppModule);

  // TCP microservice — keeps your existing developer/auth working
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: parseInt(process.env.DEVELOPER_SERVICE_TCP_PORT || '3001'),
    },
  });

  // HTTP prefix for GitHub routes
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Inject x-developer-id into req for GitHub controller
  app.use((req: any, _res: any, next: any) => {
    const id = req.headers['x-developer-id'];
    if (id) req.developerId = id;
    next();
  });

  // Start both transports
  await app.startAllMicroservices();
  await app.listen(parseInt(process.env.DEVELOPER_SERVICE_HTTP_PORT || '3011'));

  console.log('Developer Service TCP on port 3001');
  console.log('Developer Service HTTP on http://localhost:3011');
}
bootstrap();