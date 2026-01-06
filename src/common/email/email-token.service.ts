import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { v4 as uuid } from 'uuid';

import { EmailException } from '@krgeobuk/email/exception';
import { EmailService } from '@krgeobuk/email/services';
import type { EmailConfig } from '@krgeobuk/email/interfaces';

import { RedisService } from '@database/redis/redis.service.js';

/**
 * 이메일 토큰 타입
 */
export enum EmailTokenType {
  VERIFICATION = 'verification',
  PASSWORD_RESET = 'password-reset',
}

/**
 * 이메일 토큰 전송 파라미터
 */
export interface SendEmailTokenParams {
  userId: string;
  email: string;
  name: string;
  tokenType: EmailTokenType;
}

/**
 * 이메일 토큰 서비스
 * 이메일 인증 및 비밀번호 재설정을 위한 토큰 생성, 저장, 이메일 발송을 통합 처리
 */
@Injectable()
export class EmailTokenService {
  private readonly logger = new Logger(EmailTokenService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService
  ) {}

  /**
   * 토큰 생성 및 이메일 발송
   */
  async generateAndSendToken(params: SendEmailTokenParams): Promise<void> {
    const { userId, email, name, tokenType } = params;

    this.logger.log(`${this.generateAndSendToken.name} - 시작`, { tokenType, userId });

    // UUID 토큰 생성
    const token = uuid();

    // 토큰 타입별 설정 가져오기
    const { expiresIn, emailUrl, redisMethod, emailMethod } = this.getTokenConfig(tokenType);

    // 이메일 URL 생성
    const url = `${emailUrl}?token=${token}`;

    // Redis에 토큰 저장
    await redisMethod.call(this.redisService, token, userId, expiresIn);

    // 이메일 발송
    try {
      await emailMethod.call(this.emailService, { to: email, name, url });

      this.logger.log(`${this.generateAndSendToken.name} - 이메일 발송 성공`, {
        tokenType,
        email,
        userId,
      });
    } catch (error) {
      // 이메일 발송 실패 시 토큰 삭제
      await this.deleteToken(token, tokenType);

      this.logger.error(`${this.generateAndSendToken.name} - 이메일 발송 실패`, {
        tokenType,
        email,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw EmailException.sendFailed();
    }
  }

  /**
   * 토큰 타입별 설정 가져오기
   */
  private getTokenConfig(tokenType: EmailTokenType) {
    const emailConfig = this.configService.get<EmailConfig>('email');

    switch (tokenType) {
      case EmailTokenType.VERIFICATION:
        return {
          expiresIn: emailConfig?.verification?.expiresIn || 86400, // 24시간
          emailUrl: `${emailConfig?.verification?.baseUrl}/email-verify`,
          redisMethod: this.redisService.setEmailVerificationToken,
          emailMethod: (params: { to: string; name: string; url: string }) =>
            this.emailService.sendVerificationEmail({
              to: params.to,
              name: params.name,
              verificationUrl: params.url,
            }),
        };

      case EmailTokenType.PASSWORD_RESET:
        return {
          expiresIn: emailConfig?.passwordReset?.expiresIn || 3600, // 1시간
          emailUrl: `${emailConfig?.passwordReset?.baseUrl}/reset-password`,
          redisMethod: this.redisService.setPasswordResetToken,
          emailMethod: (params: { to: string; name: string; url: string }) =>
            this.emailService.sendPasswordResetEmail({
              to: params.to,
              name: params.name,
              resetUrl: params.url,
            }),
        };

      default:
        throw new Error(`Unknown token type: ${tokenType}`);
    }
  }

  /**
   * 토큰 삭제 (실패 시 롤백용)
   */
  private async deleteToken(token: string, tokenType: EmailTokenType): Promise<void> {
    switch (tokenType) {
      case EmailTokenType.VERIFICATION:
        await this.redisService.deleteEmailVerificationToken(token);
        break;
      case EmailTokenType.PASSWORD_RESET:
        await this.redisService.deletePasswordResetToken(token);
        break;
    }
  }
}
