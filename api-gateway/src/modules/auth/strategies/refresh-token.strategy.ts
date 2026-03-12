import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          // Extract from body first (as per your DTO)
          if (request.body && request.body.refresh_token) {
            return request.body.refresh_token;
          }
          // Fallback to auth header
          return ExtractJwt.fromAuthHeaderAsBearerToken()(request);
        },
      ]),
      secretOrKey: configService.get('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
      ignoreExpiration: false,
    });
  }

  async validate(req: Request, payload: any) {
    if (!payload) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    // Get the refresh token from request
    const refreshToken = req.body?.refresh_token || 
                        req.headers.authorization?.replace('Bearer', '').trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Validate that the token payload matches
    return {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      refreshToken,
    };
  }
}