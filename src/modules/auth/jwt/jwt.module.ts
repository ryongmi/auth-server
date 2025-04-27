// src/auth/jwt/jwt.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtConfigService } from './jwt-config.service';
import { JwtTokenService } from './jwt-token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      // global: true,
      useClass: JwtConfigService,
    }),
  ],
  providers: [JwtConfigService, JwtTokenService],
  exports: [JwtTokenService],
})
export class JwtConfigModule {}
