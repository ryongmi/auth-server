// src/auth/jwt/jwt-token.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signAccessToken(payload: any): Promise<string> {
    try {
      const token = await this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'), // AccessToken은 짧게
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
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'), // RefreshToken은 길게
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
      return this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch (error) {
      throw new Error('Invalid Access Token');
    }
  }

  // Refresh Token 복호화
  async decodeRefreshToken(token: string): Promise<any> {
    try {
      return this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      throw new Error('Invalid Refresh Token');
    }
  }
}
