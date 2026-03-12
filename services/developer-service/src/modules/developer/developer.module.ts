import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeveloperController } from './developer.controller';
import { DeveloperService } from './developer.service';
import { EmailService } from './email.service';
import { Developer } from './entities/developer.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Developer, RefreshToken, VerificationToken, PasswordResetToken])],
  controllers: [DeveloperController],
  providers: [DeveloperService, EmailService],
  exports: [DeveloperService],
})
export class DeveloperModule {}

