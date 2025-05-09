import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtTokenService } from '../jwt/jwt-token.service';
import { RedisService } from 'src/database/redis/redis.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtTokenService,
    private readonly redisService: RedisService,
    private readonly reflector: Reflector, // 필요한 경우 Role같은거 추후 적용용
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. 쿠키에서 Refresh Token 가져오기
    const refreshToken = request.cookies['refreshToken'];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh Token이 존재하지 않습니다.');
    }

    const blackListStore = this.configService.get<string>('jwt.blackListStore');
    const blacklistedToken = await this.redisService.getValue(
      `${blackListStore}${refreshToken}`,
    );

    if (blacklistedToken) {
      throw new UnauthorizedException('해당 리프레시 토큰은 무효화되었습니다.');
    }

    try {
      // 2. Refresh Token 검증
      const { id, tokenData } =
        await this.jwtService.decodeRefreshToken(refreshToken);

      // 3. 검증 성공 시 payload를 request.user에 저장
      request.user = { id, tokenData };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Refresh Token이 유효하지 않습니다.');
    }
  }
}
