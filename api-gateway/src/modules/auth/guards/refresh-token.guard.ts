import { 
  Injectable, 
  ExecutionContext, 
  UnauthorizedException,
  Inject
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
  constructor(
    @Inject('DEVELOPER_SERVICE') private developerService: ClientProxy
  ) {
    super();
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
      // Check if token is blacklisted/revoked before proceeding
      const isRevoked = await this.checkIfTokenRevoked(refreshToken);
      
      if (isRevoked) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // Store token in request for the strategy
      request.refreshToken = refreshToken;

      // Activate the passport strategy
      const result = (await super.canActivate(context)) as boolean;

      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    if (err || !user) {
      // Log failed refresh attempt
      this.logFailedRefreshAttempt(request, err?.message || info?.message);
      
      if (err) {
        throw err;
      }
      
      if (info?.message === 'No auth token') {
        throw new UnauthorizedException('Refresh token is required');
      }
      
      if (info?.message === 'jwt expired') {
        throw new UnauthorizedException('Refresh token has expired');
      }
      
      throw new UnauthorizedException(info?.message || 'Invalid refresh token');
    }

    // Check if user account is still active
    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Check if email is verified (if required)
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    // Attach the refresh token to the user object for the service
    user.refreshToken = request.refreshToken;
    
    return user;
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

  private async checkIfTokenRevoked(token: string): Promise<boolean> {
    try {
      // Call developer service to check if token is revoked
      const result = await firstValueFrom(
        this.developerService.send('check_refresh_token_revoked', { token })
      );
      return result.isRevoked;
    } catch (error) {
      console.error('Failed to check token revocation status:', error);
      return false; // Assume not revoked if check fails
    }
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