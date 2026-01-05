import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { EmailVerificationRequestDto, EmailVerificationConfirmDto } from '@krgeobuk/email/dtos';
import { EmailError } from '@krgeobuk/email/exception';
import { EmailResponse } from '@krgeobuk/email/response';
import {
  SwaggerApiTags,
  SwaggerApiBody,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { Serialize } from '@krgeobuk/core/decorators';

import { EmailVerificationService } from './email-verification.service.js';

/**
 * 이메일 인증 컨트롤러
 * 이메일 인증 요청 및 완료 엔드포인트 제공
 */
@SwaggerApiTags({ tags: ['email-verification'] })
@Controller('auth/verify-email')
export class EmailVerificationController {
  constructor(private readonly emailVerificationService: EmailVerificationService) {}

  /**
   * 이메일 인증 요청 (재발송)
   */
  @Post('request')
  @HttpCode(EmailResponse.VERIFICATION_REQUEST_SUCCESS.statusCode)
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { ttl: 60000, limit: 3 } }) // 1분에 3번으로 제한
  @SwaggerApiOperation({ summary: '이메일 인증 요청 (재발송)' })
  @SwaggerApiBody({
    dto: EmailVerificationRequestDto,
    description: '인증 이메일을 재발송할 이메일 주소',
  })
  @SwaggerApiOkResponse({
    status: EmailResponse.VERIFICATION_REQUEST_SUCCESS.statusCode,
    description: EmailResponse.VERIFICATION_REQUEST_SUCCESS.message,
  })
  @SwaggerApiErrorResponse({
    status: EmailError.ALREADY_VERIFIED.statusCode,
    description: EmailError.ALREADY_VERIFIED.message,
  })
  @SwaggerApiErrorResponse({
    status: EmailError.SEND_FAILED.statusCode,
    description: EmailError.SEND_FAILED.message,
  })
  @Serialize({
    ...EmailResponse.VERIFICATION_REQUEST_SUCCESS,
  })
  async requestEmailVerification(@Body() body: EmailVerificationRequestDto): Promise<void> {
    return await this.emailVerificationService.requestEmailVerification(body.email);
  }

  /**
   * 이메일 인증 완료
   */
  @Post('confirm')
  @HttpCode(EmailResponse.VERIFICATION_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '이메일 인증 완료' })
  @SwaggerApiBody({
    dto: EmailVerificationConfirmDto,
    description: '이메일로 받은 인증 토큰',
  })
  @SwaggerApiOkResponse({
    status: EmailResponse.VERIFICATION_SUCCESS.statusCode,
    description: EmailResponse.VERIFICATION_SUCCESS.message,
  })
  @SwaggerApiErrorResponse({
    status: EmailError.VERIFICATION_TOKEN_INVALID.statusCode,
    description: EmailError.VERIFICATION_TOKEN_INVALID.message,
  })
  @SwaggerApiErrorResponse({
    status: EmailError.ALREADY_VERIFIED.statusCode,
    description: EmailError.ALREADY_VERIFIED.message,
  })
  @Serialize({
    ...EmailResponse.VERIFICATION_SUCCESS,
  })
  async verifyEmail(@Body() body: EmailVerificationConfirmDto): Promise<void> {
    return await this.emailVerificationService.verifyEmail(body.token);
  }
}
