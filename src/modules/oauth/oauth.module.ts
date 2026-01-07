import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from '@krgeobuk/email';

import { JwtModule } from '@common/jwt/index.js';
import { UserModule } from '@modules/user/index.js';
import { AccountMergeModule } from '@modules/account-merge/account-merge.module.js';

import { OAuthAccountEntity } from './entities/oauth-account.entity.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthAccountController } from './oauth-account.controller.js';
import { OAuthService } from './oauth.service.js';
import { OAuthStateService } from './oauth-state.service.js';
import { GoogleOAuthService } from './google.service.js';
import { NaverOAuthService } from './naver.service.js';
import { OAuthRepository } from './oauth.repository.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([OAuthAccountEntity]),
    HttpModule,
    UserModule,
    JwtModule,
    EmailModule,
    forwardRef(() => AccountMergeModule),
  ],
  controllers: [OAuthController, OAuthAccountController],
  providers: [OAuthService, OAuthStateService, GoogleOAuthService, NaverOAuthService, OAuthRepository],
  exports: [OAuthService],
})
export class OAuthModule {}
