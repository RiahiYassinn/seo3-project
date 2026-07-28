import { Injectable, NestMiddleware, Logger, OnModuleInit } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SecurityMiddleware implements NestMiddleware, OnModuleInit {
  private readonly logger = new Logger(SecurityMiddleware.name);
  private rateLimiter: RateLimiterRedis;

  constructor(private redisService: RedisService) {}

  onModuleInit() {
    this.rateLimiter = new RateLimiterRedis({
      storeClient: this.redisService.getClient(),
      keyPrefix: 'auth_rl',
      points: 5,    // max 5 requests
      duration: 60, // per 60 seconds per IP
      // Falls back to in-memory if Redis is temporarily unavailable
      insuranceLimiter: new RateLimiterMemory({ points: 5, duration: 60 }),
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.path.startsWith('/auth')) {
      try {
        const ip = req.ip || req.connection.remoteAddress;
        await this.rateLimiter.consume(ip);

        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
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
