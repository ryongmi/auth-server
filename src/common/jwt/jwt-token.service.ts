import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';

import { decodeAccessToken } from '@krgeobuk/jwt/utils';
import { JwtException } from '@krgeobuk/jwt/exception';
import type { TokenPair, JwtPayload } from '@krgeobuk/jwt/interfaces';
import type { TokenType } from '@krgeobuk/jwt/types';
// import type { RefreshResponse } from '@krgeobuk/auth/interfaces';

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async signAccessTokenAndRefreshToken(payload: JwtPayload): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signToken(payload, 'access'),
      this.signToken(payload, 'refresh'),
    ]);

    return { accessToken, refreshToken };
  }

  async signToken(payload: JwtPayload, type: TokenType): Promise<string> {
    try {
      const secret = this.configService.get<string>(`jwt.${type}Secret`);
      const expiresIn = this.configService.get<string>(`jwt.${type}ExpiresIn`);

      if (!secret) throw JwtException.secretMissing(type);
      if (!expiresIn) throw JwtException.expireMissing(type);

      return await this.jwtService.signAsync(payload, {
        secret,
        expiresIn,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`${type} 토큰 서명 실패:`, error.message);
      } else {
        console.error(`${type} 토큰 서명 실패: 알 수 없는 에러`);
      }
      throw JwtException.signFailure(type);
    }
  }

  // async signAccessToken(payload: JwtPayload): Promise<string> {
  //   try {
  //     const secret = this.configService.get<string>('jwt.accessSecret');
  //     const expiresIn = this.configService.get<string>('jwt.accessExpiresIn');

  //     if (!secret) throw JwtException.secretMissing('access');
  //     if (!expiresIn) throw JwtException.expireMissing('access');

  //     return await this.jwtService.signAsync(payload, {
  //       secret,
  //       expiresIn, // AccessToken은 짧게
  //     });
  //   } catch (error: unknown) {
  //     if (error instanceof Error) {
  //       console.error('access 토큰 서명 실패:', error.message);
  //     } else {
  //       console.error('access 토큰 서명 실패: 알 수 없는 에러');
  //     }
  //     throw JwtException.signFailure('access');
  //   }
  // }

  // async signRefreshToken(payload: JwtPayload): Promise<string> {
  //   try {
  //     const secret = this.configService.get<string>('jwt.refreshSecret');
  //     const expiresIn = this.configService.get<string>('jwt.refreshExpiresIn');

  //     if (!secret) throw JwtException.secretMissing('refresh');
  //     if (!expiresIn) throw JwtException.expireMissing('refresh');

  //     return await this.jwtService.signAsync(payload, {
  //       secret,
  //       expiresIn, // RefreshToken은 길게
  //     });
  //   } catch (error) {
  //     if (error instanceof Error) {
  //       console.error('Refresh 토큰 서명 실패:', error.message);
  //     } else {
  //       console.error('Refresh 토큰 서명 실패: 알 수 없는 에러');
  //     }
  //     throw JwtException.signFailure('refresh');
  //   }
  // }

  // Access Token 복호화
  async decodeAccessToken(token: string): Promise<JwtPayload> {
    try {
      const secret = this.configService.get<string>('jwt.accessSecret');
      if (!secret) throw JwtException.secretMissing('access');

      return decodeAccessToken({ token, secret });
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('access 토큰 복호화 실패:', error.message);

        switch (error.name) {
          case 'TokenExpiredError':
            throw JwtException.expired('access');
          case 'JsonWebTokenError':
            throw JwtException.malformed('access');
          case 'NotBeforeError':
            throw JwtException.unsupported('access');
        }
      }

      throw JwtException.decryptionFailed('access');
    }
  }

  // Refresh Token 복호화
  async decodeRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const secret = this.configService.get<string>('jwt.refreshSecret');
      if (!secret) throw JwtException.secretMissing('refresh');

      return await this.jwtService.verifyAsync(token, {
        secret,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('refresh 토큰 복호화 실패:', error.message);

        switch (error.name) {
          case 'TokenExpiredError':
            throw JwtException.expired('refresh');
          case 'JsonWebTokenError':
            throw JwtException.malformed('refresh');
          case 'NotBeforeError':
            throw JwtException.unsupported('refresh');
        }
      }

      throw JwtException.decryptionFailed('refresh');
    }
  }

  getRefreshTokenToCookie(req: Request): string {
    const refreshTokenStore = this.configService.get<string>('jwt.refreshStore');
    if (!refreshTokenStore) throw JwtException.configMissing('refresh');

    const refreshToken = req.cookies[refreshTokenStore] as string | undefined;
    if (!refreshToken) throw JwtException.notFound('refresh');

    return refreshToken;
  }

  setRefreshTokenToCookie(res: Response, refreshToken: string): void {
    const refreshTokenStore = this.configService.get<string>('jwt.refreshStore');
    const refreshMaxAge = this.configService.get<number>('jwt.refreshMaxAge');
    const mode = this.configService.get<string>('mode');
    const cookiePath = this.configService.get<string>('jwt.sessionCookiePath');

    if (!refreshTokenStore || !mode || !refreshMaxAge || !cookiePath) {
      throw JwtException.configMissing('refresh');
    }
    if (!refreshToken) throw JwtException.notFound('refresh');

    res.cookie(refreshTokenStore, refreshToken, {
      // httpOnly: true,
      httpOnly: mode === 'production',
      secure: mode === 'production',
      sameSite: 'strict',
      path: cookiePath,
      maxAge: refreshMaxAge, // 예: 7일
    });
  }

  clearRefreshTokenCookie(res: Response): void {
    const refreshTokenStore = this.configService.get<string>('jwt.refreshStore');
    const mode = this.configService.get<string>('mode');
    const cookiePath = this.configService.get<string>('jwt.sessionCookiePath');

    if (!refreshTokenStore || !mode || !cookiePath) {
      throw JwtException.configMissing('refresh');
    }

    res.clearCookie(refreshTokenStore, {
      // httpOnly: true,
      httpOnly: mode === 'production',
      secure: mode === 'production',
      sameSite: 'strict',
      path: cookiePath,
    });
  }
}
