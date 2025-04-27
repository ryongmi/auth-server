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
    return this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'), // AccessToken은 짧게
    });
  }

  async signRefreshToken(payload: any): Promise<string> {
    return this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'), // RefreshToken은 길게
    });
  }
}
