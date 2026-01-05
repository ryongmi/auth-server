import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { ForgotPasswordRequestDto, ResetPasswordDto } from '@krgeobuk/auth/dtos';
import { AuthError } from '@krgeobuk/auth/exception';
import { AuthResponse } from '@krgeobuk/auth/response';
import { EmailError } from '@krgeobuk/email/exception';
import {
  SwaggerApiTags,
  SwaggerApiBody,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { Serialize } from '@krgeobuk/core/decorators';

import { PasswordResetService } from './password-reset.service.js';

/**
 * 비밀번호 재설정 컨트롤러
 * 비밀번호 재설정 요청 및 실행 엔드포인트 제공
 */
@SwaggerApiTags({ tags: ['password-reset'] })
@Controller('auth')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  /**
   * 비밀번호 재설정 요청 (이메일 발송)
   */
  @Post('forgot-password')
  @HttpCode(AuthResponse.PASSWORD_RESET_EMAIL_SENT.statusCode)
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { ttl: 60000, limit: 3 } }) // 1분에 3번으로 제한
  @SwaggerApiOperation({ summary: '비밀번호 재설정 요청 (이메일 발송)' })
  @SwaggerApiBody({
    dto: ForgotPasswordRequestDto,
    description: '비밀번호 재설정 이메일을 받을 이메일 주소',
  })
  @SwaggerApiOkResponse({
    status: AuthResponse.PASSWORD_RESET_EMAIL_SENT.statusCode,
    description: AuthResponse.PASSWORD_RESET_EMAIL_SENT.message,
  })
  @SwaggerApiErrorResponse({
    status: EmailError.SEND_FAILED.statusCode,
    description: EmailError.SEND_FAILED.message,
  })
  @Serialize({
    ...AuthResponse.PASSWORD_RESET_EMAIL_SENT,
  })
  async forgotPassword(@Body() body: ForgotPasswordRequestDto): Promise<void> {
    return await this.passwordResetService.requestPasswordReset(body.email);
  }

  /**
   * 비밀번호 재설정 실행
   */
  @Post('reset-password')
  @HttpCode(AuthResponse.PASSWORD_RESET_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '비밀번호 재설정 실행' })
  @SwaggerApiBody({
    dto: ResetPasswordDto,
    description: '이메일로 받은 재설정 토큰과 새 비밀번호',
  })
  @SwaggerApiOkResponse({
    status: AuthResponse.PASSWORD_RESET_SUCCESS.statusCode,
    description: AuthResponse.PASSWORD_RESET_SUCCESS.message,
  })
  @SwaggerApiErrorResponse({
    status: AuthError.PASSWORD_RESET_TOKEN_INVALID.statusCode,
    description: AuthError.PASSWORD_RESET_TOKEN_INVALID.message,
  })
  @Serialize({
    ...AuthResponse.PASSWORD_RESET_SUCCESS,
  })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    return await this.passwordResetService.resetPassword(body.token, body.password);
  }
}
