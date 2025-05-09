import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { JwtException } from '../../../exception';
import { UserPayload } from 'src/common/interface';

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
      const secret = this.configService.get<string>('jwt.accessSecret');
      const expiresIn = this.configService.get<string>('jwt.accessExpiresIn');

      const token = await this.jwtService.signAsync(payload, {
        secret,
        expiresIn, // AccessToken은 짧게
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
      const secret = this.configService.get<string>('jwt.refreshSecret');
      const expiresIn = this.configService.get<string>('jwt.refreshExpiresIn');
      const token = await this.jwtService.signAsync(payload, {
        secret,
        expiresIn, // RefreshToken은 길게
      });

      return token;
    } catch (error) {
      console.error('JWT 토큰 서명 실패', error);
      throw new Error('Invalid token');
      // throw new InternalServerErrorException('리프레시 토큰 생성 실패');
    }
  }

  // Access Token 복호화
  async decodeAccessToken(token: string): Promise<Partial<UserPayload>> {
    try {
      const secret = this.configService.get<string>('jwt.accessSecret');
      const payload = await this.jwtService.verifyAsync(token, {
        secret,
      });

      return payload;
    } catch (error) {
      throw new Error('Invalid Access Token');
    }
  }

  // Refresh Token 복호화
  async decodeRefreshToken(token: string): Promise<Partial<UserPayload>> {
    try {
      const secret = this.configService.get<string>('jwt.refreshSecret');
      const payload = await this.jwtService.verifyAsync(token, {
        secret,
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
    const mode = this.configService.get<string>('mode');
    const cookiePath = this.configService.get<string>('jwt.sessionCookiePath');

    res.cookie(refreshTokenStore, refreshToken, {
      // httpOnly: true,
      httpOnly: mode === 'production',
      secure: mode === 'production',
      sameSite: 'strict',
      path: cookiePath,
      maxAge: refreshMaxAge, // 예: 7일
    });
  }

  clearRefreshTokenCookie(res: Response) {
    const refreshTokenStore =
      this.configService.get<string>('jwt.refreshStore');
    const mode = this.configService.get<string>('mode');
    const cookiePath = this.configService.get<string>('jwt.sessionCookiePath');

    res.clearCookie(refreshTokenStore, {
      // httpOnly: true,
      httpOnly: mode === 'production',
      secure: mode === 'production',
      sameSite: 'strict',
      path: cookiePath,
    });
  }
}
