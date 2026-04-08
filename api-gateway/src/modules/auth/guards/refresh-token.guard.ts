import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  CanActivate,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(
    @Inject('DEVELOPER_SERVICE') private developerService: ClientProxy
  ) {
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const refreshToken = this.extractRefreshToken(request);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Validate refresh token format
    if (!this.isValidRefreshTokenFormat(refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    try {
      const tokenRecord = await firstValueFrom(
        this.developerService.send('find_refresh_token_by_hash', {
          tokenHash: this.hashToken(refreshToken),
        }),
      );

      if (!tokenRecord) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (tokenRecord.is_revoked) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      if (new Date(tokenRecord.expires_at) < new Date()) {
        throw new UnauthorizedException('Refresh token has expired');
      }

      const user = await firstValueFrom(
        this.developerService.send('find_user_by_id', { id: tokenRecord.developer_id }),
      );

      if (!user || !user.is_active) {
        throw new UnauthorizedException('User account is deactivated');
      }

      if (!user.is_email_verified) {
        throw new UnauthorizedException('Please verify your email first');
      }

      request.refreshToken = refreshToken;
      request.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        refreshToken,
      };

      return true;
    } catch (error) {
      this.logFailedRefreshAttempt(request, error instanceof Error ? error.message : 'Invalid refresh token');

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private extractRefreshToken(request: any): string | null {
    // Check in body first (as per your DTO)
    if (request.body && request.body.refresh_token) {
      return request.body.refresh_token;
    }

    // Check in headers
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check in cookies (if using cookies)
    if (request.cookies && request.cookies.refresh_token) {
      return request.cookies.refresh_token;
    }

    return null;
  }

  private isValidRefreshTokenFormat(token: string): boolean {
    // Check if token is a valid UUID (since we're using uuidv4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(token);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private logFailedRefreshAttempt(request: any, reason: string) {
    const logData = {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
      reason,
      tokenPresent: !!this.extractRefreshToken(request)
    };
    
    console.error('Refresh token attempt failed:', logData);
    
    // Emit to Kafka if available
    // this.kafkaClient.emit('auth.refresh.failed', logData);
  }
}
