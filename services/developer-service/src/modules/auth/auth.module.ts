import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DeveloperModule } from '../developer/developer.module';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    DeveloperModule,
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
