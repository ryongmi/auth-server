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
import { OAuthTokenTcpController } from './oauth-token-tcp.controller.js';
import { OAuthService } from './oauth.service.js';
import { OAuthStateService } from './oauth-state.service.js';
import { OAuthTokenService } from './oauth-token.service.js';
import { OAuthAuthenticationService } from './oauth-authentication.service.js';
import { OAuthLinkageService } from './oauth-linkage.service.js';
import { OAuthUserService } from './oauth-user.service.js';
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
  controllers: [OAuthController, OAuthAccountController, OAuthTokenTcpController],
  providers: [
    OAuthService,
    OAuthStateService,
    OAuthTokenService,
    OAuthAuthenticationService,
    OAuthLinkageService,
    OAuthUserService,
    GoogleOAuthService,
    NaverOAuthService,
    OAuthRepository,
  ],
  exports: [OAuthService, OAuthTokenService],
})
export class OAuthModule {}
