import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
    process.exit(1);
  });

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'], // ← max verbosity
  });
  
  const tcpPort = parseInt(process.env.DEVELOPER_SERVICE_PORT) || 3001;
  
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: tcpPort,
    },
  });

  await app.startAllMicroservices();
  
  const httpPort = parseInt(process.env.DEVELOPER_SERVICE_HTTP_PORT) || 3011;
  await app.listen(httpPort);

  console.log(`✅ TCP listening on port ${tcpPort}`);
  console.log(`✅ HTTP listening on port ${httpPort}`);
}

bootstrap().catch(err => {
  console.error('BOOTSTRAP FAILED:', err); // ← catches silent crash
  process.exit(1);
})
