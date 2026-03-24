import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeveloperModule } from './modules/developer/developer.module';

import { Developer } from './modules/developer/entities/developer.entity';
import { RefreshToken } from './modules/developer/entities/refresh-token.entity';
import { VerificationToken } from './modules/developer/entities/verification-token.entity';
import { PasswordResetToken } from './modules/developer/entities/password-reset-token.entity';
import { GitHubModule } from './modules/github/github.module';
import { GitHubIntegration } from './modules/github/entities/github-integration.entity';
import { Repository } from './modules/github/entities/repository.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: parseInt(configService.get('POSTGRES_PORT')) || 5432,
        username: configService.get('POSTGRES_USER'),
        password: configService.get('POSTGRES_PASSWORD'),
        database: configService.get('POSTGRES_DB'),
        entities: [Developer, RefreshToken, VerificationToken, PasswordResetToken, GitHubIntegration, Repository],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    DeveloperModule,
    GitHubModule,
  ],
})
export class AppModule {}

