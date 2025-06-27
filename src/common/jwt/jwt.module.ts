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
      provide: 'JWT_ACCESS_PUBLIC_KEY',
      useFactory: (configService: ConfigService): string => {
        const publicKey = configService.get<string>('jwt.accessPublicKey');
        if (!publicKey) throw JwtException.publicKeyMissing('access');
        return publicKey;
      },
      inject: [ConfigService],
    },
    // {
    //   provide: 'REFRESH_TOKEN', useClass: '해당서비스'
    // },
  ],
  exports: [JwtTokenService, 'JWT_ACCESS_PUBLIC_KEY'], // 다른 모듈에서 사용 가능하도록 export
})
export class JwtModule {}
