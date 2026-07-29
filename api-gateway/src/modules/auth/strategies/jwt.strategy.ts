import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @Inject('DEVELOPER_SERVICE') private developerService: ClientProxy,
  ) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET');

    // Fail early with a clear error message if the environment variable is missing
    if (!secret) {
      throw new Error(
        'JwtStrategy: "JWT_ACCESS_SECRET" is undefined in ConfigService. Check your .env file or environment configuration.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    try {
      // Verify user still exists and is active via microservice call
      const user = await firstValueFrom(
        this.developerService.send('find_user_by_id', { id: payload.sub }),
      );

      if (!user || !user.is_active) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}