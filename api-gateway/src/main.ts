import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger documentation - must be set up BEFORE middleware
  const config = new DocumentBuilder()
    .setTitle('SEO3 Developer Platform API')
    .setDescription('API Gateway for Developer Analytics Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('developers', 'Developer management')
    .addTag('skills', 'Skill management')
    .addTag('analysis', 'Code analysis')
    .addTag('recommendations', 'Learning recommendations')
    .addTag('notifications', 'Notification management')
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

 
  app.setGlobalPrefix('api/v1');

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

  // Compression
  app.use(compression());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.API_GATEWAY_PORT || 3006;
  await app.listen(port);

  console.log(`API Gateway is running on: http://localhost:${port}`);
  console.log(`API Documentation: http://localhost:${port}/docs`);
}

bootstrap();