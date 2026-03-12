// apps/api-gateway/src/middleware/security.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);
  private readonly rateLimiter: RateLimiterMemory;

  constructor(private redisService: RedisService) {
    this.rateLimiter = new RateLimiterMemory({
      points: 5, // Number of points
      duration: 60, // Per 60 seconds
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // Apply stricter rate limiting for auth endpoints
    if (req.path.startsWith('/auth')) {
      try {
        const ip = req.ip || req.connection.remoteAddress;
        await this.rateLimiter.consume(ip);
        
        // Add security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        
        // Set CSP for auth endpoints
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self'; object-src 'none';"
        );
        
        next();
      } catch (error) {
        this.logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
          message: 'Too many requests, please try again later.',
        });
      }
    } else {
      next();
    }
  }
}