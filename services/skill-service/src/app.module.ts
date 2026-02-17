import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SkillModule } from './modules/skill/skill.module';
import { SkillGraphModule } from './modules/skill-graph/skill-graph.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    MongooseModule.forRoot(process.env.MONGODB_URL),
    SkillModule,
    SkillGraphModule,
  ],
})
export class AppModule {}
