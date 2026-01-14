import { Injectable, Logger } from '@nestjs/common';

import { AuthException } from '@krgeobuk/auth/exception';

import { RedisService } from '@database/redis/redis.service.js';
import { hashPassword } from '@common/utils/index.js';
import { UserService } from '@modules/user/index.js';
import { EmailTokenService, EmailTokenType } from '@common/email/index.js';
import { BaseTokenVerificationService } from '@common/services/index.js';
import type { UserEntity } from '@modules/user/entities/user.entity.js';

/**
 * 비밀번호 재설정 서비스
 * 비밀번호 재설정 요청, 실행, 이메일 발송 처리
 */
@Injectable()
export class PasswordResetService extends BaseTokenVerificationService<string> {
  protected readonly logger = new Logger(PasswordResetService.name);

  constructor(
    redisService: RedisService,
    userService: UserService,
    emailTokenService: EmailTokenService
  ) {
    super(redisService, userService, emailTokenService);
  }

  /**
   * 비밀번호 재설정 요청 (이메일 발송)
   */
  async requestPasswordReset(email: string): Promise<void> {
    await this.requestToken(email, EmailTokenType.PASSWORD_RESET, this.requestPasswordReset.name);
  }

  /**
   * 토큰 요청 시 사용자 검증
   * 비밀번호 재설정은 추가 검증이 필요 없음
   */
  protected validateUserForRequest(_user: UserEntity): void {
    // 비밀번호 재설정은 추가 검증이 필요 없음
  }

  /**
   * 비밀번호 재설정 실행
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.verifyToken(
      token,
      this.redisService.getPasswordResetToken,
      this.redisService.deletePasswordResetToken,
      this.resetPassword.name,
      newPassword
    );
  }

  /**
   * 토큰 검증 후 사용자 처리
   * 비밀번호 재설정 처리
   */
  protected async processUserVerification(user: UserEntity, newPassword: string): Promise<void> {
    // 새 비밀번호 해싱
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
  }

  /**
   * 토큰 무효화 예외 반환
   */
  protected getTokenInvalidException(): Error {
    return AuthException.passwordResetTokenInvalid();
  }

}
