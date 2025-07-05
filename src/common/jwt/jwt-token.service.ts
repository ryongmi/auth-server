import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';

// import { decodeAccessToken } from '@krgeobuk/jwt/utils';
import { JwtException } from '@krgeobuk/jwt/exception';
import type { JwtTokenPair, JwtPayload } from '@krgeobuk/jwt/interfaces';
import type { JwtTokenType } from '@krgeobuk/jwt/types';
// import type { RefreshResponse } from '@krgeobuk/auth/interfaces';

import { DefaultConfig, JwtConfig } from '@common/interfaces/index.js';

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async signAccessTokenAndRefreshToken(payload: JwtPayload): Promise<JwtTokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signToken(payload, 'access'),
      this.signToken(payload, 'refresh'),
    ]);

    return { accessToken, refreshToken };
  }

  async signToken(payload: JwtPayload, type: JwtTokenType): Promise<string> {
    try {
      const privateKey = this.configService.get<
        JwtConfig['accessPrivateKey' | 'refreshPrivateKey']
      >(`jwt.${type}PrivateKey`);
      const expiresIn = this.configService.get<JwtConfig['accessExpiresIn' | 'refreshExpiresIn']>(
        `jwt.${type}ExpiresIn`
      );

      if (!privateKey) throw JwtException.privateKeyMissing(type);
      if (!expiresIn) throw JwtException.expireMissing(type);

      return await this.jwtService.signAsync(payload, {
        privateKey,
        algorithm: 'RS256',
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

  // Access Token 검증
  // async decodeAccessToken(token: string): Promise<JwtPayload> {
  //   try {
  //     const PublicKey = this.configService.get<string>('jwt.accessPublicKey');
  //     if (!PublicKey) throw JwtException.secretMissing('access');

  //     return decodeAccessToken({ token, PublicKey });
  //   } catch (error: unknown) {
  //     if (error instanceof Error) {
  //       console.error('access 토큰 검증 실패:', error.message);

  //       switch (error.name) {
  //         case 'TokenExpiredError':
  //           throw JwtException.expired('access');
  //         case 'JsonWebTokenError':
  //           throw JwtException.malformed('access');
  //         case 'NotBeforeError':
  //           throw JwtException.unsupported('access');
  //       }
  //     }

  //     throw JwtException.decryptionFailed('access');
  //   }
  // }

  // Refresh Token 검증
  async decodeRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const publicKey =
        this.configService.get<JwtConfig['refreshPublicKey']>('jwt.refreshPublicKey');
      if (!publicKey) throw JwtException.publicKeyMissing('refresh');

      return await this.jwtService.verifyAsync(token, {
        publicKey,
        algorithms: ['RS256'],
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('refresh 토큰 검증 실패:', error.message);

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
    const refreshTokenStore = this.configService.get<JwtConfig['refreshStore']>('jwt.refreshStore');
    if (!refreshTokenStore) throw JwtException.configMissing('refresh');

    const refreshToken = req.cookies[refreshTokenStore] as string | undefined;
    if (!refreshToken) throw JwtException.notFound('refresh');

    return refreshToken;
  }

  setRefreshTokenToCookie(res: Response, refreshToken: string): void {
    const refreshTokenStore = this.configService.get<JwtConfig['refreshStore']>('jwt.refreshStore');
    const refreshMaxAge = this.configService.get<JwtConfig['refreshMaxAge']>('jwt.refreshMaxAge');
    const mode = this.configService.get<DefaultConfig['mode']>('mode');
    const cookiePath =
      this.configService.get<JwtConfig['sessionCookiePath']>('jwt.sessionCookiePath');

    if (!refreshTokenStore || !mode || !refreshMaxAge || !cookiePath) {
      throw JwtException.configMissing('refresh');
    }
    if (!refreshToken) throw JwtException.notFound('refresh');

    res.cookie(refreshTokenStore, refreshToken, {
      httpOnly: mode === 'production',
      secure: mode === 'production',
      sameSite: 'strict',
      path: cookiePath,
      maxAge: refreshMaxAge, // 예: 7일
    });
  }

  clearRefreshTokenCookie(res: Response): void {
    const refreshTokenStore = this.configService.get<JwtConfig['refreshStore']>('jwt.refreshStore');
    const mode = this.configService.get<DefaultConfig['mode']>('mode');
    const cookiePath =
      this.configService.get<JwtConfig['sessionCookiePath']>('jwt.sessionCookiePath');

    if (!refreshTokenStore || !mode || !cookiePath) {
      throw JwtException.configMissing('refresh');
    }

    res.clearCookie(refreshTokenStore, {
      httpOnly: mode === 'production',
      secure: mode === 'production',
      sameSite: 'strict',
      path: cookiePath,
    });
  }
}
