import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Request } from 'express';

import { AuthException } from '@krgeobuk/auth/exception';

import { DefaultConfig } from '@common/interfaces/index.js';

@Injectable()
export class OriginValidationGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.get('Origin') || request.get('Referer');

    if (!origin) {
      throw AuthException.refreshError();
    }

    const allowedOrigins = this.getAllowedOrigins();
    const isValidOrigin = this.validateOrigin(origin, allowedOrigins);

    if (!isValidOrigin) {
      throw AuthException.refreshError();
    }

    return true;
  }

  private getAllowedOrigins(): string[] {
    const corsOrigins = this.configService.get<DefaultConfig['corsOrigins']>('corsOrigins');
    if (!corsOrigins) {
      return [];
    }
    return corsOrigins.split(',').map((origin: string) => origin.trim());
  }

  private validateOrigin(origin: string, allowedOrigins: string[]): boolean {
    try {
      const originUrl = new URL(origin);
      const originWithPort = `${originUrl.protocol}//${originUrl.host}`;

      return allowedOrigins.some((allowedOrigin) => {
        // 정확한 일치
        if (originWithPort === allowedOrigin.trim()) return true;

        // 서브도메인 일치 확인
        const allowedUrl = new URL(allowedOrigin.trim());
        if (originUrl.hostname.endsWith(`.${allowedUrl.hostname}`)) {
          return true;
        }

        return false;
      });
    } catch {
      return false;
    }
  }
}
