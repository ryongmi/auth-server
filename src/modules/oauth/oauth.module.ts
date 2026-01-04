import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from '@krgeobuk/email';

import { JwtModule } from '@common/jwt/index.js';
import { UserModule } from '@modules/user/index.js';

import { OAuthAccountEntity } from './entities/oauth-account.entity.js';
import { AccountMergeRequestEntity } from './entities/account-merge-request.entity.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthAccountController } from './oauth-account.controller.js';
import { OAuthService } from './oauth.service.js';
import { GoogleOAuthService } from './google.service.js';
import { NaverOAuthService } from './naver.service.js';
import { OAuthRepository } from './oauth.repository.js';
import { AccountMergeRequestRepository } from './account-merge-request.repository.js';
import { AccountMergeOrchestrator } from './account-merge.orchestrator.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([OAuthAccountEntity, AccountMergeRequestEntity]),
    HttpModule,
    UserModule,
    JwtModule,
    EmailModule,
  ],
  controllers: [OAuthController, OAuthAccountController],
  providers: [
    OAuthService,
    GoogleOAuthService,
    NaverOAuthService,
    OAuthRepository,
    AccountMergeRequestRepository,
    AccountMergeOrchestrator,
  ],
  exports: [OAuthService, AccountMergeOrchestrator],
})
export class OAuthModule {}
