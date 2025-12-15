import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtModule } from '@common/jwt/index.js';
import { UserModule } from '@modules/user/index.js';

import { OAuthAccountEntity } from './entities/oauth-account.entity.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthAccountController } from './oauth-account.controller.js';
import { OAuthService } from './oauth.service.js';
import { GoogleOAuthService } from './google.service.js';
import { NaverOAuthService } from './naver.service.js';
import { OAuthRepository } from './oauth.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([OAuthAccountEntity]), HttpModule, UserModule, JwtModule],
  controllers: [OAuthController, OAuthAccountController],
  providers: [OAuthService, GoogleOAuthService, NaverOAuthService, OAuthRepository], // 서비스를 providers에 추가
  exports: [OAuthService], // 다른 모듈에서 OAuth 서비스를 사용할 수 있도록 exports에 추가
})
export class OAuthModule {}
