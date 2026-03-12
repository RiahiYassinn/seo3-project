import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Check if it's a login attempt with username/email and password
    const { username_or_email, password } = request.body;
    
    if (!username_or_email || !password) {
      throw new UnauthorizedException('Username/email and password are required');
    }

    // Store credentials in request for the strategy
    request.loginCredentials = {
      usernameOrEmail: username_or_email,
      password: password
    };

    // Activate the guard
    const result = (await super.canActivate(context)) as boolean;
    
    // Log the login attempt (successful or failed)
    await this.logLoginAttempt(request);
    
    return result;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    if (err || !user) {
      // Log failed login attempt
      this.logLoginAttempt(request, false, err?.message || 'Invalid credentials');
      
      if (err) {
        throw err;
      }
      
      if (info?.message === 'Missing credentials') {
        throw new UnauthorizedException('Invalid credentials format');
      }
      
      throw new UnauthorizedException(info?.message || 'Invalid credentials');
    }
    
    return user;
  }

  private async logLoginAttempt(request: any, success: boolean = true, reason?: string) {
    try {
      // You can inject a service here to log to database/Kafka
      const loginData = {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        usernameOrEmail: request.body?.username_or_email,
        timestamp: new Date().toISOString(),
        success,
        reason
      };
      
      // Emit to Kafka or store in database
      console.log('Login attempt logged:', loginData);
      
      // If you have Kafka client, emit event
      // this.kafkaClient.emit('auth.login.attempt', loginData);
    } catch (error) {
      console.error('Failed to log login attempt:', error);
    }
  }
}