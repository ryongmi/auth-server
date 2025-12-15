import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { EmailModule } from '@krgeobuk/email';

import { JwtModule } from '@common/jwt/index.js';
import { UserModule } from '@modules/user/index.js';
import { OAuthModule } from '@modules/oauth/index.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [HttpModule, UserModule, OAuthModule, JwtModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthService], // 서비스를 providers에 추가
  exports: [AuthService], // 다른 모듈에서 User 서비스를 사용할 수 있도록 exports에 추가
})
export class AuthModule {}
