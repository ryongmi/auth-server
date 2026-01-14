import { Injectable, Logger } from '@nestjs/common';

import { EmailException } from '@krgeobuk/email/exception';

import { RedisService } from '@database/redis/redis.service.js';
import { UserService } from '@modules/user/index.js';
import { EmailTokenService, EmailTokenType } from '@common/email/index.js';
import { BaseTokenVerificationService } from '@common/services/index.js';
import type { UserEntity } from '@modules/user/entities/user.entity.js';

/**
 * 이메일 인증 서비스
 * 이메일 인증 요청, 인증 완료, 인증 이메일 발송 처리
 */
@Injectable()
export class EmailVerificationService extends BaseTokenVerificationService<void> {
  protected readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    redisService: RedisService,
    userService: UserService,
    emailTokenService: EmailTokenService
  ) {
    super(redisService, userService, emailTokenService);
  }

  /**
   * 이메일 인증 요청 (재발송)
   */
  async requestEmailVerification(email: string): Promise<void> {
    await this.requestToken(email, EmailTokenType.VERIFICATION, this.requestEmailVerification.name);
  }

  /**
   * 토큰 요청 시 사용자 검증
   * 이미 인증된 사용자인지 확인
   */
  protected validateUserForRequest(user: UserEntity): void {
    if (user.isEmailVerified) {
      throw EmailException.alreadyVerified();
    }
  }

  /**
   * 이메일 인증 완료
   */
  async verifyEmail(token: string): Promise<void> {
    await this.verifyToken(
      token,
      this.redisService.getEmailVerificationToken,
      this.redisService.deleteEmailVerificationToken,
      this.verifyEmail.name
    );
  }

  /**
   * 토큰 검증 후 사용자 처리
   * 이메일 인증 완료 처리
   */
  protected async processUserVerification(user: UserEntity): Promise<void> {
    // 이미 인증된 경우
    if (user.isEmailVerified) {
      throw EmailException.alreadyVerified();
    }

    user.isEmailVerified = true;
  }

  /**
   * 토큰 무효화 예외 반환
   */
  protected getTokenInvalidException(): Error {
    return EmailException.verificationTokenInvalid();
  }

}
