import { Injectable, Logger } from '@nestjs/common';
import { RateLimiterMemory as RateLimiter } from 'rate-limiter-flexible';

export interface RateLimiterOptions {
  points: number;      // Number of points
  duration: number;    // Per duration in seconds
  blockDuration?: number; // Block for N seconds if consumed more than points
}

@Injectable()
export class RateLimiterMemory {
  private readonly logger = new Logger(RateLimiterMemory.name);
  private limiters: Map<string, RateLimiter> = new Map();

  constructor() {
    // Initialize default rate limiters
    this.initializeDefaultLimiters();
  }

  private initializeDefaultLimiters() {
    // Auth endpoints rate limiter (5 requests per minute)
    this.createLimiter('auth', {
      points: 5,
      duration: 60,
      blockDuration: 300 // 5 minutes block
    });

    // API endpoints rate limiter (100 requests per minute)
    this.createLimiter('api', {
      points: 100,
      duration: 60,
      blockDuration: 60 // 1 minute block
    });

    // Public endpoints rate limiter (30 requests per minute)
    this.createLimiter('public', {
      points: 30,
      duration: 60,
      blockDuration: 120 // 2 minutes block
    });
  }

  createLimiter(name: string, options: RateLimiterOptions) {
    const limiter = new RateLimiter({
      points: options.points,
      duration: options.duration,
      blockDuration: options.blockDuration,
    });
    this.limiters.set(name, limiter);
    this.logger.log(`Rate limiter '${name}' initialized with ${options.points} points per ${options.duration}s`);
  }

  async consume(name: string, key: string, points: number = 1): Promise<any> {
    const limiter = this.limiters.get(name);
    if (!limiter) {
      this.logger.warn(`Rate limiter '${name}' not found, using default`);
      return this.consume('api', key, points);
    }

    try {
      const result = await limiter.consume(key, points);
      return {
        success: true,
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext,
        consumedPoints: result.consumedPoints
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      // Rate limiter error format
      return {
        success: false,
        remainingPoints: error.remainingPoints,
        msBeforeNext: error.msBeforeNext,
        consumedPoints: error.consumedPoints
      };
    }
  }

  async get(name: string, key: string): Promise<any> {
    const limiter = this.limiters.get(name);
    if (!limiter) return null;

    try {
      const result = await limiter.get(key);
      return result;
    } catch (error) {
      this.logger.error(`Error getting rate limiter data: ${error.message}`);
      return null;
    }
  }

  async delete(name: string, key: string): Promise<void> {
    const limiter = this.limiters.get(name);
    if (!limiter) return;

    try {
      await limiter.delete(key);
      this.logger.debug(`Rate limiter data deleted for ${name}:${key}`);
    } catch (error) {
      this.logger.error(`Error deleting rate limiter data: ${error.message}`);
    }
  }

  async block(name: string, key: string, duration: number): Promise<void> {
    const limiter = this.limiters.get(name);
    if (!limiter) return;

    try {
      await limiter.block(key, duration);
      this.logger.warn(`Rate limiter blocked ${name}:${key} for ${duration}s`);
    } catch (error) {
      this.logger.error(`Error blocking rate limiter: ${error.message}`);
    }
  }

  async resetAll(): Promise<void> {
    for (const [name, limiter] of this.limiters) {
      await limiter.delete('*');
      this.logger.log(`Rate limiter '${name}' reset`);
    }
  }
}