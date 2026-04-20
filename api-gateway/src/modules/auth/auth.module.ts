// apps/api-gateway/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { RedisModule } from '../../redis/redis.module'; 
import { RateLimiterMemory } from '../../middleware/rate-limiter.memory'; 

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    RedisModule, 
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_ACCESS_SECRET'),
        signOptions: { 
          expiresIn: configService.get('JWT_ACCESS_EXPIRATION', '15m') 
        },
      }),
      inject: [ConfigService],
    }),
    ClientsModule.registerAsync([
      {
        name: 'DEVELOPER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get('DEVELOPER_SERVICE_HOST', 'localhost'),
            port: configService.get('DEVELOPER_SERVICE_PORT', 3001),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    RefreshTokenStrategy,
    GoogleStrategy,
    LocalAuthGuard,
    RefreshTokenGuard,
    GoogleAuthGuard,
    RateLimiterMemory, 
  ],
  exports: [AuthService, LocalAuthGuard, RefreshTokenGuard, GoogleAuthGuard]
})
export class AuthModule {}