import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { v4 as uuid } from 'uuid';

import { AuthException } from '@krgeobuk/auth/exception';
import { EmailException } from '@krgeobuk/email/exception';
import { UserException } from '@krgeobuk/user/exception';
import { EmailService } from '@krgeobuk/email/services';
import type { EmailConfig } from '@krgeobuk/email/interfaces';

import { RedisService } from '@database/redis/redis.service.js';
import { hashPassword } from '@common/utils/index.js';
import { UserService } from '@modules/user/index.js';

/**
 * 비밀번호 재설정 서비스
 * 비밀번호 재설정 요청, 실행, 이메일 발송 처리
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly userService: UserService,
    private readonly emailService: EmailService
  ) {}

  /**
   * 비밀번호 재설정 요청 (이메일 발송)
   */
  async requestPasswordReset(email: string): Promise<void> {
    this.logger.log(`${this.requestPasswordReset.name} - 시작되었습니다.`);

    // 사용자 존재 확인
    const user = (await this.userService.findByAnd({ email }))[0];
    if (!user) {
      throw UserException.userNotFound();
    }

    // 이메일 발송
    await this.sendPasswordResetEmail(user.id, user.email, user.name);

    this.logger.log(`${this.requestPasswordReset.name} - 비밀번호 재설정 이메일 발송 완료`);
  }

  /**
   * 비밀번호 재설정 실행
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    this.logger.log(`${this.resetPassword.name} - 시작되었습니다.`);

    // Redis에서 토큰 조회
    const userId = await this.redisService.getPasswordResetToken(token);
    if (!userId) {
      throw AuthException.passwordResetTokenInvalid();
    }

    // 사용자 조회
    const user = await this.userService.findById(userId);
    if (!user) {
      throw UserException.userNotFound();
    }

    // 새 비밀번호 해싱
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;

    // 비밀번호 업데이트
    await this.userService.updateUser(user);

    // 토큰 삭제 (일회성)
    await this.redisService.deletePasswordResetToken(token);

    this.logger.log(`${this.resetPassword.name} - 비밀번호 재설정 완료`, { userId });
  }

  /**
   * 비밀번호 재설정 이메일 발송 (내부 메서드)
   */
  private async sendPasswordResetEmail(userId: string, email: string, name: string): Promise<void> {
    this.logger.log(`${this.sendPasswordResetEmail.name} - 시작되었습니다.`);

    // UUID 토큰 생성
    const token = uuid();

    // 이메일 설정 가져오기
    const emailConfig = this.configService.get<EmailConfig>('email');
    const expiresIn = 3600; // 1시간
    const resetUrl = `${emailConfig?.verification?.baseUrl}/reset-password?token=${token}`;

    // Redis에 토큰 저장
    await this.redisService.setPasswordResetToken(token, userId, expiresIn);

    // 이메일 발송
    try {
      await this.emailService.sendPasswordResetEmail({
        to: email,
        name,
        resetUrl,
      });
      this.logger.log(`${this.sendPasswordResetEmail.name} - 이메일 발송 성공`, { email, userId });
    } catch (error) {
      // 이메일 발송 실패 시 토큰 삭제
      await this.redisService.deletePasswordResetToken(token);

      this.logger.error(`${this.sendPasswordResetEmail.name} - 이메일 발송 실패`, {
        email,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw EmailException.sendFailed();
    }
  }
}
