import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { Request } from 'express';

import { JwtException } from '@krgeobuk/jwt/exception';

import { JwtConfig } from '@common/interfaces/index.js';
import { RedisService } from '@database/index.js';

import { JwtTokenService } from '../jwt-token.service.js';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  private readonly logger = new Logger(RefreshTokenGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtTokenService,
    private readonly redisService: RedisService,
    private readonly _reflector: Reflector // 필요한 경우 Role같은거 추후 적용용
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. 쿠키에서 Refresh Token 가져오기
    const refreshToken = request.cookies['refreshToken'];

    if (!refreshToken) throw JwtException.notFound('refresh');

    const blackListStore =
      this.configService.get<JwtConfig['blackListStore']>('jwt.blackListStore');
    const blacklistedToken = await this.redisService.getValue(`${blackListStore}${refreshToken}`);

    if (blacklistedToken) throw JwtException.invalid('refresh');

    try {
      // 2. Refresh Token 검증
      const { sub, tokenData, iat, exp } = await this.jwtService.decodeRefreshToken(refreshToken);

      // 3. 검증 성공 시 payload를 request.user에 저장
      request.jwt = {
        userId: sub,
        tokenData,
        iat,
        exp,
      };

      return true;
    } catch (error: unknown) {
      // 내부 로그: 리프레시 토큰 검증 에러 상세 정보
      const internalMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(
        `[REFRESH_TOKEN_GUARD_ERROR] Refresh Token 검증 실패 - Internal: ${internalMessage}`,
        {
          action: 'refresh_token_validation',
          errorType: errorName,
          tokenPresent: !!refreshToken,
          stack,
        }
      );

      // 클라이언트용: 에러 타입에 따른 적절한 메시지
      if (error instanceof Error && 'name' in error) {
        const name = (error as { name: string }).name;

        switch (name) {
          case 'TokenExpiredError':
            throw JwtException.expired('refresh');
          case 'JsonWebTokenError':
            throw JwtException.malformed('refresh');
          case 'NotBeforeError':
            throw JwtException.unsupported('refresh');
          default:
            throw JwtException.invalid('refresh');
        }
      }

      // Error 객체가 아닌 예상치 못한 에러
      throw JwtException.invalid('refresh');
    }
  }
}
