import { Module } from '@nestjs/common';

import { RedirectValidationService } from './redirect-validation.service.js';

/**
 * 보안 모듈
 * 리다이렉트 검증 등 보안 관련 서비스 제공
 */
@Module({
  providers: [RedirectValidationService],
  exports: [RedirectValidationService],
})
export class SecurityModule {}
