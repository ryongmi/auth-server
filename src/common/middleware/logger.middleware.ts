import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, query, params, body } = req;
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length');
      const responseTime = Date.now() - startTime;

      const logMessage = `${method} ${originalUrl} ${statusCode} ${contentLength} - ${responseTime}ms`;

      const queryParams = JSON.stringify(query);
      const routeParams = JSON.stringify(params);
      const requestBody = method !== 'GET' ? JSON.stringify(body) : null;

      let completeLogMessage = `${logMessage} \nQuery Params: ${queryParams} \nRoute Params: ${routeParams}`;
      if (requestBody) {
        completeLogMessage += ` \nBody: ${requestBody}`;
      }

      this.logger.log(completeLogMessage);
    });

    next();
  }
}
