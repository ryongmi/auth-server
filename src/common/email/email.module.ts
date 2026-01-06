import { Module } from '@nestjs/common';

import { EmailModule as SharedEmailModule } from '@krgeobuk/email';

import { EmailTokenService } from './email-token.service.js';

/**
 * 공통 이메일 모듈
 * 이메일 토큰 생성 및 발송 기능 제공
 */
@Module({
  imports: [SharedEmailModule],
  providers: [EmailTokenService],
  exports: [EmailTokenService],
})
export class CommonEmailModule {}
