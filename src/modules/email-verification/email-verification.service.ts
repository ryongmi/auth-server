import { Injectable, Logger } from '@nestjs/common';

import { EmailException } from '@krgeobuk/email/exception';
import { UserException } from '@krgeobuk/user/exception';

import { RedisService } from '@database/redis/redis.service.js';
import { UserService } from '@modules/user/index.js';
import { EmailTokenService, EmailTokenType } from '@common/email/index.js';

/**
 * 이메일 인증 서비스
 * 이메일 인증 요청, 인증 완료, 인증 이메일 발송 처리
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly userService: UserService,
    private readonly emailTokenService: EmailTokenService
  ) {}

  /**
   * 이메일 인증 요청 (재발송)
   */
  async requestEmailVerification(email: string): Promise<void> {
    this.logger.log(`${this.requestEmailVerification.name} - 시작되었습니다.`);

    // 사용자 존재 확인
    const user = (await this.userService.findByAnd({ email }))[0];
    if (!user) {
      throw UserException.userNotFound();
    }

    // 이미 인증된 사용자
    if (user.isEmailVerified) {
      throw EmailException.alreadyVerified();
    }

    // 이메일 발송
    await this.sendVerificationEmail(user.id, user.email, user.name);

    this.logger.log(`${this.requestEmailVerification.name} - 인증 이메일 발송 완료`);
  }

  /**
   * 이메일 인증 완료
   */
  async verifyEmail(token: string): Promise<void> {
    this.logger.log(`${this.verifyEmail.name} - 시작되었습니다.`);

    // Redis에서 토큰 조회
    const userId = await this.redisService.getEmailVerificationToken(token);
    if (!userId) {
      throw EmailException.verificationTokenInvalid();
    }

    // 사용자 조회
    const user = await this.userService.findById(userId);
    if (!user) {
      throw UserException.userNotFound();
    }

    // 이미 인증된 경우
    if (user.isEmailVerified) {
      // 토큰 삭제
      await this.redisService.deleteEmailVerificationToken(token);
      throw EmailException.alreadyVerified();
    }

    user.isEmailVerified = true;

    // 이메일 인증 완료
    await this.userService.updateUser(user);

    // 토큰 삭제 (일회성)
    await this.redisService.deleteEmailVerificationToken(token);

    this.logger.log(`${this.verifyEmail.name} - 이메일 인증 완료`, { userId });
  }

  /**
   * 인증 이메일 발송 (내부 메서드)
   */
  async sendVerificationEmail(userId: string, email: string, name: string): Promise<void> {
    await this.emailTokenService.generateAndSendToken({
      userId,
      email,
      name,
      tokenType: EmailTokenType.VERIFICATION,
    });
  }
}
