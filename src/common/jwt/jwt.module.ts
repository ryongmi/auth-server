import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { JwtException } from '@krgeobuk/jwt/exception';

import { JwtTokenService } from './jwt-token.service.js';

@Module({
  providers: [
    JwtService,
    JwtTokenService,
    {
      provide: 'JWT_ACCESS_SECRET',
      useFactory: (configService: ConfigService): string => {
        const secret = configService.get<string>('jwt.accessSecret');
        if (!secret) throw JwtException.secretMissing('access');
        return secret;
      },
      inject: [ConfigService],
    },
  ],
  exports: [JwtTokenService], // JwtTokenService를 다른 모듈에서 사용 가능하도록 export
})
export class JwtModule {}
