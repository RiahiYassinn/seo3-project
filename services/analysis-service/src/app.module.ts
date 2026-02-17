import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookModule } from './modules/webhook/webhook.module';
import { CommitModule } from './modules/commit/commit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    MongooseModule.forRoot(process.env.MONGODB_URL),
    WebhookModule,
    CommitModule,
  ],
})
export class AppModule {}
