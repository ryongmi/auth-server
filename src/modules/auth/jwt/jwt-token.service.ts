// src/auth/jwt/jwt-token.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { JwtException } from '../../../exception';

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signAccessTokenAndRefreshToken(payload: any) {
    const accessToken = await this.signAccessToken(payload);
    const refreshToken = await this.signRefreshToken(payload);

    return { accessToken, refreshToken };
  }

  async signAccessToken(payload: any): Promise<string> {
    try {
      const token = await this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn'), // AccessToken은 짧게
      });

      return token;
    } catch (error) {
      console.error('JWT 토큰 서명 실패', error);
      throw new Error('Invalid token');
      // throw new InternalServerErrorException('에세스 토큰 생성 실패');
    }
  }

  async signRefreshToken(payload: any): Promise<string> {
    try {
      const token = await this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'), // RefreshToken은 길게
      });

      return token;
    } catch (error) {
      console.error('JWT 토큰 서명 실패', error);
      throw new Error('Invalid token');
      // throw new InternalServerErrorException('리프레시 토큰 생성 실패');
    }
  }

  // Access Token 복호화
  async decodeAccessToken(token: string): Promise<any> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });

      return payload;
    } catch (error) {
      throw new Error('Invalid Access Token');
    }
  }

  // Refresh Token 복호화
  async decodeRefreshToken(token: string): Promise<any> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      return payload;
    } catch (error) {
      throw new Error('Invalid Refresh Token');
    }
  }

  getRefreshTokenToCookie(req: Request): string {
    const refreshTokenStore =
      this.configService.get<string>('jwt.refreshStore');
    const refreshToken = req.cookies[refreshTokenStore];

    if (!refreshToken) {
      throw JwtException.refreshTokenNotFound();
    }

    return refreshToken;
  }

  setRefreshTokenToCookie(res: Response, refreshToken: string) {
    const refreshTokenStore =
      this.configService.get<string>('jwt.refreshStore');
    const refreshMaxAge = this.configService.get<number>('jwt.refreshMaxAge');

    res.cookie(refreshTokenStore, refreshToken, {
      // httpOnly: true,
      httpOnly: this.configService.get<string>('mode') === 'production',
      secure: this.configService.get<string>('mode') === 'production',
      sameSite: 'strict',
      path: this.configService.get<string>('jwt.sessionCookiePath'),
      maxAge: refreshMaxAge, // 예: 7일
    });
  }

  clearRefreshTokenCookie(res: Response) {
    const refreshTokenStore =
      this.configService.get<string>('jwt.refreshStore');

    res.clearCookie(refreshTokenStore, {
      // httpOnly: true,
      httpOnly: this.configService.get<string>('mode') === 'production',
      secure: this.configService.get<string>('mode') === 'production',
      sameSite: 'strict',
      path: this.configService.get<string>('jwt.sessionCookiePath'),
    });
  }
}
