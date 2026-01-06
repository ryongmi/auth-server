import { Module } from '@nestjs/common';

import { UserModule } from '@modules/user/index.js';
import { CommonEmailModule } from '@common/email/index.js';

import { PasswordResetService } from './password-reset.service.js';
import { PasswordResetController } from './password-reset.controller.js';

/**
 * 비밀번호 재설정 모듈
 * 비밀번호 재설정 요청 및 실행 기능 제공
 */
@Module({
  imports: [CommonEmailModule, UserModule],
  controllers: [PasswordResetController],
  providers: [PasswordResetService],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
