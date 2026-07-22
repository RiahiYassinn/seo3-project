import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';
import * as express from 'express';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { AppModule } from './app.module';

function parseCookies(cookieHeader?: string) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce((cookies, pair) => {
    const [rawName, ...rawValue] = pair.trim().split('=');

    if (!rawName) {
      return cookies;
    }

    cookies[rawName] = decodeURIComponent(rawValue.join('='));
    return cookies;
  }, {} as Record<string, string>);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  const config = new DocumentBuilder()
    .setTitle('SEO3 Developer Platform API')
    .setDescription('API Gateway for Developer Analytics Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'Authentication and session management')
    .addTag('Admin', 'Admin management')
    .addTag('developers', 'Developer management')
    .addTag('github', 'GitHub integration')
    .addTag('skills', 'Skill management')
    .addTag('analysis', 'Code analysis')
    .addTag('recommendations', 'Learning recommendations')
    .addTag('notifications', 'Notification management')
    .addTag('health', 'Health checks')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });
  SwaggerModule.setup('docs', app, document, {
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js',
    ],
  });

  // Security - configure helmet to allow Swagger UI
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  app.use((req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
  });

  // Compression - bypassed for the SSE notification stream, which must flush
  // events immediately rather than being buffered for gzip.
  app.use(
    compression({
      filter: (req, res) =>
        req.path.endsWith('/notifications/stream')
          ? false
          : compression.filter(req, res),
    }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Kafka consumer for realtime notification fan-out. Each instance uses a
  // unique clientId/groupId so every gateway process receives every
  // notification.created event instead of Kafka partitioning them across
  // instances - correctness depends on this since SSE connections are only
  // known to the instance holding them in memory.
  const instanceId = randomUUID();
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: `api-gateway-${instanceId}`,
        brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
      },
      consumer: {
        groupId: `api-gateway-notifications-${instanceId}`,
      },
    },
  });
  await app.startAllMicroservices();

  const port = process.env.API_GATEWAY_PORT || 3006;
  await app.listen(port);

  console.log(`API Gateway is running on: http://localhost:${port}`);
  console.log(`API Documentation: http://localhost:${port}/docs`);
}

bootstrap();
