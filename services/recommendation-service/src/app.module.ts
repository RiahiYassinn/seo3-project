import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningPathModule } from './modules/learning-path/learning-path.module';
import { MentorMatchingModule } from './modules/mentor-matching/mentor-matching.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      // Set DB_SYNC=true for the first boot against an empty database.
      synchronize:
        process.env.DB_SYNC === 'true' || process.env.NODE_ENV === 'development',
    }),
    LearningPathModule,
    MentorMatchingModule,
  ],
})
export class AppModule {}
