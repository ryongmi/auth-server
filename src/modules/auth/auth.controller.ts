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

import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';

import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';
import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
import {
  AuthLoginRequestDto,
  AuthSignupRequestDto,
  AuthRefreshResponseDto,
} from '@krgeobuk/auth/dtos';
import { AuthError } from '@krgeobuk/auth/exception';
import { AuthResponse } from '@krgeobuk/auth/response';
import {
  SwaggerApiTags,
  SwaggerApiBody,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { JwtPayload, AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';

import { RefreshTokenGuard } from '@common/jwt/index.js';

import { AuthService } from './auth.service.js';

@SwaggerApiTags({ tags: ['auth'] })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('/login')
  @SwaggerApiOperation({ summary: 'SSO 로그인 리다이렉트' })
  @SwaggerApiOkResponse({
    status: 302,
    description: 'Auth Client로 리다이렉트',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '잘못된 리다이렉트 URI',
  })
  async ssoLoginRedirect(
    @Query('redirect_uri') redirectUri: string,
    @Res() res: Response
  ): Promise<void> {
    const redirectUrl = await this.authService.ssoLoginRedirect(redirectUri);
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
  @HttpCode(302)
  @SwaggerApiOperation({ summary: 'SSO 로그인 처리' })
  @SwaggerApiBody({
    dto: AuthLoginRequestDto,
    description: 'SSO 로그인시 필요한 BODY값',
  })
  @SwaggerApiOkResponse({
    status: 302,
    description: '로그인 성공 후 원래 서비스로 리다이렉트',
  })
  @SwaggerApiErrorResponse({
    status: AuthError.LOGIN_ERROR.statusCode,
    description: AuthError.LOGIN_ERROR.message,
  })
  async login(
    @Res() res: Response,
    @Body() body: AuthLoginRequestDto,
    @Query('redirect_session') redirectSession: string
  ): Promise<void> {
    const redirectUrl = await this.authService.login(res, body, redirectSession);
    return res.redirect(redirectUrl);
  }

  @Post('/signup')
  @HttpCode(302)
  @UseInterceptors(TransactionInterceptor)
  @SwaggerApiOperation({ summary: 'SSO 회원가입 처리' })
  @SwaggerApiBody({
    dto: AuthSignupRequestDto,
    description: 'SSO 회원가입시 필요한 BODY값',
  })
  @SwaggerApiOkResponse({
    status: 302,
    description: '회원가입 성공 후 자동 로그인 및 원래 서비스로 리다이렉트',
  })
  @SwaggerApiErrorResponse({
    status: AuthError.SIGNUP_ERROR.statusCode,
    description: AuthError.SIGNUP_ERROR.message,
  })
  async signup(
    @Res() res: Response,
    @Body() body: AuthSignupRequestDto,
    @Query('redirect_session') redirectSession: string,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<void> {
    const redirectUrl = await this.authService.signup(res, body, redirectSession, transactionManager);
    return res.redirect(redirectUrl);
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
  @UseGuards(RefreshTokenGuard)
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
}

