import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';

import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';
import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
import {
  AuthLoginRequestDto,
  AuthSignupRequestDto,
  AuthRefreshResponseDto,
  AuthLoginResponseDto,
  AuthSignupResponseDto,
  AuthInitializeResponseDto,
} from '@krgeobuk/auth/dtos';
import { AuthError } from '@krgeobuk/auth/exception';
import { AuthResponse } from '@krgeobuk/auth/response';
import { EmailError } from '@krgeobuk/email/exception';
import { EmailResponse } from '@krgeobuk/email/response';
import { EmailVerificationRequestDto, EmailVerificationConfirmDto } from '@krgeobuk/email/dtos';
import {
  SwaggerApiTags,
  SwaggerApiBody,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { JwtPayload, AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';

import { RefreshTokenGuard, OptionalRefreshTokenGuard } from '@common/jwt/index.js';
import { OriginValidationGuard } from '@common/guards/origin-validation.guard.js';

import { AuthService } from './auth.service.js';

@SwaggerApiTags({ tags: ['auth'] })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('/login')
  @HttpCode(AuthResponse.SSO_LOGIN_START_REDIRECT.statusCode)
  @SwaggerApiOperation({ summary: 'SSO 로그인 리다이렉트' })
  @SwaggerApiOkResponse({
    status: AuthResponse.SSO_LOGIN_START_REDIRECT.statusCode,
    description: AuthResponse.SSO_LOGIN_START_REDIRECT.message,
  })
  @SwaggerApiErrorResponse({
    status: AuthError.INVALID_REDIRECT_URI.statusCode,
    description: AuthError.INVALID_REDIRECT_URI.message,
  })
  async ssoLoginRedirect(
    @Query('redirect_uri') redirectUri: string,
    @Res() res: Response,
    @Req() req: Request
  ): Promise<void> {
    const redirectUrl = await this.authService.ssoLoginRedirect(redirectUri, req);
    return res.redirect(redirectUrl);
  }

  @Post('/logout')
  @HttpCode(AuthResponse.LOGOUT_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '로그아웃' })
  @SwaggerApiOkResponse({
    status: AuthResponse.LOGOUT_SUCCESS.statusCode,
    description: AuthResponse.LOGOUT_SUCCESS.message,
  })
  @SwaggerApiErrorResponse({
    status: AuthError.LOGOUT_ERROR.statusCode,
    description: AuthError.LOGOUT_ERROR.message,
  })
  @Serialize({
    ...AuthResponse.LOGOUT_SUCCESS,
    // message: '로그아웃 성공',
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    return await this.authService.logout(req, res);
  }

  @Post('/login')
  // @HttpCode(AuthResponse.SSO_LOGIN_REDIRECT.statusCode)
  @SwaggerApiOperation({ summary: 'SSO 로그인 처리' })
  @SwaggerApiBody({
    dto: AuthLoginRequestDto,
    description: 'SSO 로그인시 필요한 BODY값',
  })
  @SwaggerApiOkResponse({
    status: AuthResponse.SSO_LOGIN_REDIRECT.statusCode,
    description: AuthResponse.SSO_LOGIN_REDIRECT.message,
  })
  @SwaggerApiErrorResponse({
    status: AuthError.LOGIN_ERROR.statusCode,
    description: AuthError.LOGIN_ERROR.message,
  })
  @Serialize({
    ...AuthResponse.SSO_LOGIN_REDIRECT,
    dto: AuthLoginResponseDto,
    // message: '로그아웃 성공',
  })
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body() body: AuthLoginRequestDto,
    @Query('redirect_session') redirectSession: string
  ): Promise<AuthLoginResponseDto> {
    const redirectUrl = await this.authService.login(res, body, redirectSession);
    return { redirectUrl };
  }

  @Post('/signup')
  // @HttpCode(AuthResponse.SSO_SIGNUP_REDIRECT.statusCode)
  @UseInterceptors(TransactionInterceptor)
  @SwaggerApiOperation({ summary: 'SSO 회원가입 처리' })
  @SwaggerApiBody({
    dto: AuthSignupRequestDto,
    description: 'SSO 회원가입시 필요한 BODY값',
  })
  @SwaggerApiOkResponse({
    status: AuthResponse.SSO_SIGNUP_REDIRECT.statusCode,
    description: AuthResponse.SSO_SIGNUP_REDIRECT.message,
  })
  @SwaggerApiErrorResponse({
    status: AuthError.SIGNUP_ERROR.statusCode,
    description: AuthError.SIGNUP_ERROR.message,
  })
  @Serialize({
    ...AuthResponse.SSO_SIGNUP_REDIRECT,
    dto: AuthSignupResponseDto,
    // message: '회원가입 성공',
  })
  async signup(
    @Res({ passthrough: true }) res: Response,
    @Body() body: AuthSignupRequestDto,
    @Query('redirect_session') redirectSession: string,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<AuthSignupResponseDto> {
    const redirectUrl = await this.authService.signup(
      res,
      body,
      redirectSession,
      transactionManager
    );
    return { redirectUrl };
  }

  @Post('refresh')
  @HttpCode(AuthResponse.REFRESH_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '토큰 재발급' })
  @SwaggerApiOkResponse({
    status: AuthResponse.REFRESH_SUCCESS.statusCode,
    description: AuthResponse.REFRESH_SUCCESS.message,
    dto: AuthRefreshResponseDto,
  })
  @SwaggerApiErrorResponse({
    status: AuthError.REFRESH_ERROR.statusCode,
    description: AuthError.REFRESH_ERROR.message,
  })
  @UseGuards(ThrottlerGuard, RefreshTokenGuard, OriginValidationGuard)
  @Throttle({ short: { ttl: 1000, limit: 2 } }) // 1초에 2번으로 제한
  @Serialize({
    dto: AuthRefreshResponseDto,
    ...AuthResponse.REFRESH_SUCCESS,
  })
  async refresh(@CurrentJwt() jwt: AuthenticatedJwt): Promise<AuthRefreshResponseDto> {
    const payload: JwtPayload = {
      sub: jwt.userId,
      tokenData: jwt.tokenData,
    };

    return await this.authService.refresh(payload);
  }

  @Post('initialize')
  @HttpCode(AuthResponse.INITIALIZE_SUCCESS.statusCode)
  @SwaggerApiOperation({
    summary: '클라이언트 초기화 (RefreshToken으로 AccessToken 및 사용자 정보 반환)',
  })
  @SwaggerApiOkResponse({
    status: AuthResponse.INITIALIZE_SUCCESS.statusCode,
    description: AuthResponse.INITIALIZE_SUCCESS.message,
    dto: AuthInitializeResponseDto,
  })
  @SwaggerApiErrorResponse({
    status: AuthError.REFRESH_ERROR.statusCode,
    description: AuthError.REFRESH_ERROR.message,
  })
  @UseGuards(ThrottlerGuard, OptionalRefreshTokenGuard, OriginValidationGuard)
  @Throttle({ short: { ttl: 1000, limit: 3 } }) // 1초에 3번으로 제한
  @Serialize({
    dto: AuthInitializeResponseDto,
    ...AuthResponse.INITIALIZE_SUCCESS,
  })
  async initialize(@CurrentJwt() jwt: AuthenticatedJwt): Promise<AuthInitializeResponseDto> {
    const payload: JwtPayload = {
      sub: jwt.userId,
      tokenData: jwt.tokenData,
    };

    return await this.authService.initialize(payload);
  }

  @Post('verify-email/request')
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
    return await this.authService.requestEmailVerification(body.email);
  }

  @Post('verify-email/confirm')
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
    return await this.authService.verifyEmail(body.token);
  }
}
