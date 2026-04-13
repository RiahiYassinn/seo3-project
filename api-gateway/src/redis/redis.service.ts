// apps/api-gateway/src/redis/redis.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis;
  private subscriberClient: Redis;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      const redisConfig = {
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD'),
        db: this.configService.get('REDIS_DB', 0),
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      };

      // Main Redis client for operations
      this.redisClient = new Redis(redisConfig);
      
      // Subscriber client for pub/sub (Redis requires separate client for subscriptions)
      this.subscriberClient = new Redis(redisConfig);

      // Setup event handlers
      this.redisClient.on('connect', () => {
        this.logger.log('Redis client connected');
      });

      this.redisClient.on('ready', () => {
        this.isConnected = true;
        this.logger.log('Redis client ready');
      });

      this.redisClient.on('error', (error) => {
        this.logger.error(`Redis client error: ${error.message}`);
      });

      this.redisClient.on('close', () => {
        this.isConnected = false;
        this.logger.warn('Redis connection closed');
      });

      // Connect to Redis
      await this.redisClient.connect();
      await this.subscriberClient.connect();

      this.logger.log('Redis service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to connect to Redis: ${error.message}`);
      // Don't throw, allow app to run with degraded functionality
      this.isConnected = false;
    }
  }

  private async disconnect() {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      if (this.subscriberClient) {
        await this.subscriberClient.quit();
      }
      this.logger.log('Redis disconnected');
    } catch (error) {
      this.logger.error(`Error disconnecting Redis: ${error.message}`);
    }
  }

  // Basic operations
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping set operation');
      return;
    }

    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl) {
        await this.redisClient.setex(key, ttl, stringValue);
      } else {
        await this.redisClient.set(key, stringValue);
      }
    } catch (error) {
      this.logger.error(`Redis set error for key ${key}: ${error.message}`);
    }
  }

  async get(key: string): Promise<any> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping get operation');
      return null;
    }

    try {
      const value = await this.redisClient.get(key);
      if (value) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return null;
    } catch (error) {
      this.logger.error(`Redis get error for key ${key}: ${error.message}`);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.error(`Redis del error for key ${key}: ${error.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const result = await this.redisClient.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis exists error for key ${key}: ${error.message}`);
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.redisClient.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Redis expire error for key ${key}: ${error.message}`);
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isConnected) return -2;

    try {
      return await this.redisClient.ttl(key);
    } catch (error) {
      this.logger.error(`Redis ttl error for key ${key}: ${error.message}`);
      return -2;
    }
  }

  // Session management
  async setSession(userId: string, sessionData: any, ttl: number = 3600): Promise<void> {
    const sessionKey = `session:${userId}`;
    await this.set(sessionKey, sessionData, ttl);
    this.logger.debug(`Session set for user ${userId}`);
  }

  async getSession(userId: string): Promise<any> {
    const sessionKey = `session:${userId}`;
    return this.get(sessionKey);
  }

  async deleteSession(userId: string): Promise<void> {
    const sessionKey = `session:${userId}`;
    await this.del(sessionKey);
    this.logger.debug(`Session deleted for user ${userId}`);
  }

  async updateSession(userId: string, updates: any): Promise<void> {
    const sessionKey = `session:${userId}`;
    const currentSession = await this.getSession(userId);
    
    if (currentSession) {
      const updatedSession = { ...currentSession, ...updates };
      const ttl = await this.ttl(sessionKey);
      await this.set(sessionKey, updatedSession, ttl > 0 ? ttl : 3600);
    }
  }

  // Rate limiting
  async incrementRateLimit(key: string, windowMs: number, maxRequests: number): Promise<{
    current: number;
    remaining: number;
    resetTime: number;
  }> {
    const rateLimitKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Remove old entries outside the window
      await this.redisClient.zremrangebyscore(rateLimitKey, 0, windowStart);
      
      // Count requests in current window
      const currentCount = await this.redisClient.zcard(rateLimitKey);
      
      if (currentCount >= maxRequests) {
        const oldestRequest = await this.redisClient.zrange(rateLimitKey, 0, 0);
        const oldestTime = oldestRequest[0] ? parseInt(oldestRequest[0].split(':')[1]) : now;
        const resetTime = oldestTime + windowMs;
        
        return {
          current: currentCount,
          remaining: 0,
          resetTime
        };
      }

      // Add current request
      const requestId = `${Date.now()}:${Math.random().toString(36).substring(7)}`;
      await this.redisClient.zadd(rateLimitKey, now, requestId);
      
      // Set expiry on the sorted set
      await this.redisClient.expire(rateLimitKey, Math.ceil(windowMs / 1000));

      return {
        current: currentCount + 1,
        remaining: maxRequests - (currentCount + 1),
        resetTime: now + windowMs
      };
    } catch (error) {
      this.logger.error(`Rate limit error for key ${key}: ${error.message}`);
      return {
        current: 0,
        remaining: maxRequests,
        resetTime: now + windowMs
      };
    }
  }

  // Cache management
  async cacheGet<T>(key: string): Promise<T | null> {
    return this.get(key);
  }

  async cacheSet(key: string, value: any, ttl: number = 300): Promise<void> {
    await this.set(key, value, ttl);
  }

  async cacheDelete(key: string): Promise<void> {
    await this.del(key);
  }

  async cacheDeletePattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        this.logger.debug(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Redis cache delete pattern error: ${error.message}`);
    }
  }

  // Pub/Sub
  async publish(channel: string, message: any): Promise<void> {
    if (!this.isConnected) return;

    try {
      const stringMessage = typeof message === 'string' ? message : JSON.stringify(message);
      await this.redisClient.publish(channel, stringMessage);
    } catch (error) {
      this.logger.error(`Redis publish error on channel ${channel}: ${error.message}`);
    }
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.subscriberClient.subscribe(channel);
      this.subscriberClient.on('message', (ch, message) => {
        if (ch === channel) {
          try {
            const parsedMessage = JSON.parse(message);
            callback(parsedMessage);
          } catch {
            callback(message);
          }
        }
      });
      this.logger.log(`Subscribed to Redis channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Redis subscribe error on channel ${channel}: ${error.message}`);
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.subscriberClient.unsubscribe(channel);
      this.logger.log(`Unsubscribed from Redis channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Redis unsubscribe error on channel ${channel}: ${error.message}`);
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const result = await this.redisClient.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error(`Redis ping failed: ${error.message}`);
      return false;
    }
  }

  // Get connection status
  getStatus(): boolean {
    return this.isConnected;
  }

  // Get Redis client (for advanced operations)
  getClient(): Redis {
    return this.redisClient;
  }
}
