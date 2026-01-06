import { Module } from '@nestjs/common';

import { UserModule } from '@modules/user/index.js';
import { CommonEmailModule } from '@common/email/index.js';

import { EmailVerificationService } from './email-verification.service.js';
import { EmailVerificationController } from './email-verification.controller.js';

/**
 * 이메일 인증 모듈
 * 이메일 인증 요청, 인증 완료 기능 제공
 */
@Module({
  imports: [CommonEmailModule, UserModule],
  controllers: [EmailVerificationController],
  providers: [EmailVerificationService],
  exports: [EmailVerificationService],
})
export class EmailVerificationModule {}
