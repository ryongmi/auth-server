import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { JwtException } from '@krgeobuk/jwt/exception';

import { RedisService } from '@database';

import { JwtTokenService } from '../jwt-token.service.js';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
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

    const blackListStore = this.configService.get<string>('jwt.blackListStore');
    const blacklistedToken = await this.redisService.getValue(`${blackListStore}${refreshToken}`);

    if (blacklistedToken) throw JwtException.invalid('refresh');

    try {
      // 2. Refresh Token 검증
      const { id, tokenData } = await this.jwtService.decodeRefreshToken(refreshToken);

      // 3. 검증 성공 시 payload를 request.user에 저장
      request.jwt = { id, tokenData };

      return true;
    } catch (error: unknown) {
      console.error('Refresh Token 검증 실패:', error);

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
