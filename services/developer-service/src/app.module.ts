import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeveloperModule } from './modules/developer/developer.module';
import { GithubModule } from "./modules/github/github.module";

import { Developer } from './modules/developer/entities/developer.entity';
import { RefreshToken } from './modules/developer/entities/refresh-token.entity';
import { VerificationToken } from './modules/developer/entities/verification-token.entity';
import { PasswordResetToken } from './modules/developer/entities/password-reset-token.entity';
import { GithubIntegration } from './modules/github/entities/github-integration.entity';
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
        entities: [Developer, RefreshToken, VerificationToken, PasswordResetToken, GithubIntegration, Repository],
        // The entities above are the schema source of truth (the SQL files under
        // migrations/ predate them and are stale). Production containers start
        // with DB_SYNC unset, so set DB_SYNC=true for the first boot against an
        // empty database to have TypeORM create the tables.
        synchronize:
          configService.get('DB_SYNC') === 'true' ||
          configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    DeveloperModule,
    GithubModule,
  ],
})
export class AppModule {}

