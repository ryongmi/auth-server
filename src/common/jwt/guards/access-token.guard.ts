import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { JwtException } from '@krgeobuk/jwt/exception';
import { JwtTokenService } from '../jwt-token.service.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtTokenService,
    private readonly reflector: Reflector // 필요한 경우 Role같은 거 추후 적용용
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. accessToken을 body 또는 Authorization 헤더에서 추출
    let accessToken = request.body.accessToken;

    if (!accessToken) {
      const authorization = request.headers.authorization;

      if (!authorization) throw JwtException.notFound('access');
      if (!authorization.startsWith('Bearer ')) throw JwtException.missingBearer();

      accessToken = authorization.split(' ')[1];
    }

    try {
      // 2. 토큰 검증
      const { id, tokenData } = await this.jwtService.decodeAccessToken(accessToken);

      // 3. 요청에 유저 정보 주입
      request.jwt = { id, tokenData };

      return true;
    } catch (error: unknown) {
      console.error('Access Token 검증 실패:', error);

      if (error instanceof Error && 'name' in error) {
        const name = (error as { name: string }).name;

        switch (name) {
          case 'TokenExpiredError':
            throw JwtException.expired('access');
          case 'JsonWebTokenError':
            throw JwtException.malformed('access');
          case 'NotBeforeError':
            throw JwtException.unsupported('access');
          default:
            throw JwtException.invalid('access');
        }
      }

      // Error 객체가 아닌 예상치 못한 에러
      throw JwtException.invalid('access');
    }
  }
}
