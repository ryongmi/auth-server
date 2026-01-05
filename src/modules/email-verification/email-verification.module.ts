import { Module } from '@nestjs/common';

import { EmailModule } from '@krgeobuk/email';

import { UserModule } from '@modules/user/index.js';

import { EmailVerificationService } from './email-verification.service.js';
import { EmailVerificationController } from './email-verification.controller.js';

/**
 * 이메일 인증 모듈
 * 이메일 인증 요청, 인증 완료 기능 제공
 */
@Module({
  imports: [EmailModule, UserModule],
  controllers: [EmailVerificationController],
  providers: [EmailVerificationService],
  exports: [EmailVerificationService],
})
export class EmailVerificationModule {}
