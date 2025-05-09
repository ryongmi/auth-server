import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtTokenService } from '../jwt/jwt-token.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtTokenService,
    private readonly reflector: Reflector, // 필요한 경우 Role같은거 추후 적용용
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. Access Token 가져오기 (body 또는 Authorization 헤더에서)
    // const accessToken = request.headers['authorization']?.split(' ')[1];
    const accessToken =
      request.body.accessToken ||
      (request.headers.authorization &&
        request.headers.authorization.split(' ')[1]);

    if (!accessToken) {
      throw new UnauthorizedException('Access Token이 존재하지 않습니다.');
    }

    try {
      // 2. Access Token 검증
      const { id, tokenData } =
        await this.jwtService.decodeAccessToken(accessToken);

      // 3. 검증 성공 시 요청 객체에 사용자 정보 저장
      request.user = { id, tokenData }; // 이후 컨트롤러에서 @Req()로 user 접근 가능

      return true;
    } catch (error) {
      throw new UnauthorizedException('Access Token이 유효하지 않습니다.');
    }
  }
}
