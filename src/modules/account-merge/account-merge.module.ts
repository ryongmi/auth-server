import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from '@krgeobuk/email';

import { JwtModule } from '@common/jwt/index.js';
import { UserModule } from '@modules/user/index.js';
import { OAuthModule } from '@modules/oauth/index.js';

import { AccountMergeEntity } from './entities/account-merge.entity.js';
import { AccountMergeRepository } from './repositories/account-merge.repository.js';
import { AccountMergeService } from './account-merge.service.js';
import { AccountMergeController } from './account-merge.controller.js';
import { AccountMergeOrchestrator } from './account-merge.orchestrator.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountMergeEntity]),
    EmailModule,
    JwtModule,
    UserModule,
    forwardRef(() => OAuthModule),
  ],
  controllers: [AccountMergeController],
  providers: [AccountMergeService, AccountMergeRepository, AccountMergeOrchestrator],
  exports: [AccountMergeService, AccountMergeOrchestrator],
})
export class AccountMergeModule {}
