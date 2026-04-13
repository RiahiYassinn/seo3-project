import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, NextFunction } from 'express';

@Injectable()
export class DeveloperIdMiddleware implements NestMiddleware {
  use(req: Request & { developerId?: string }, next: NextFunction) {
    const developerId = req.headers['x-developer-id'] as string;
    if (!developerId) throw new BadRequestException('Missing x-developer-id header');
    req.developerId = developerId;
    next();
  }
}
