import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { Request } from 'express';

import { JwtConfig } from '@common/interfaces/index.js';
import { RedisService } from '@database/redis/redis.service.js';

import { JwtTokenService } from '../jwt-token.service.js';

@Injectable()
export class OptionalRefreshTokenGuard implements CanActivate {
  private readonly logger = new Logger(OptionalRefreshTokenGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtTokenService,
    private readonly redisService: RedisService,
    private readonly _reflector: Reflector // 필요한 경우 Role같은거 추후 적용용
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 초기 더미 정보 설정
    request.jwt = {
      userId: '',
      iat: 0,
      exp: 0,
    };

    // 1. 쿠키에서 Refresh Token 가져오기
    const refreshToken = request.cookies['refreshToken'];

    if (!refreshToken) {
      return true;
    }

    const blackListStore =
      this.configService.get<JwtConfig['blackListStore']>('jwt.blackListStore');
    const blacklistedToken = await this.redisService.getValue(`${blackListStore}${refreshToken}`);

    if (blacklistedToken) {
      return true;
    }

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
      this.logger.error('Optional Refresh Token 검증 실패:', error);

      // 토큰이 유효하지 않아도 통과 (옵셔널)
      // 단, jwt 정보는 주입하지 않음
      return true;
    }
  }
}
