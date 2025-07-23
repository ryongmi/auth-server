import { Controller, Get, HttpCode, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EntityManager } from 'typeorm';
import { Response } from 'express';

import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';
import { NaverOAuthCallbackQueryDto, GoogleOAuthCallbackQueryDto } from '@krgeobuk/oauth/dtos';
import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import { AuthLoginResponseDto } from '@krgeobuk/auth/dtos';
import { OAuthResponse } from '@krgeobuk/oauth/response';
import { OAuthError } from '@krgeobuk/oauth/exception';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';

import { GoogleConfig, NaverConfig } from '@common/interfaces/index.js';

import { NaverOAuthStateGuard, GoogleOAuthStateGuard } from './guards/oauth-state.guard.js';
import { OAuthService } from './oauth.service.js';

@SwaggerApiTags({ tags: ['oauth'] })
@Controller('oauth')
export class OAuthController {
  constructor(
    private configService: ConfigService,
    private oauthService: OAuthService
  ) {}

  @Get('login-google')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '구글 로그인' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '구글 로그인 OAuth로 redirect 성공',
  })
  async loginGoogle(
    @Res() res: Response,
    @Query('redirect-session') redirectSession?: string
  ): Promise<void> {
    const state = await this.oauthService.generateState(
      OAuthAccountProviderType.GOOGLE,
      redirectSession
    );
    const clientId = this.configService.get<GoogleConfig['clientId']>('google.clientId');
    const redirectUrl = this.configService.get<GoogleConfig['redirectUrl']>('google.redirectUrl');

    const url =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUrl}` +
      '&response_type=code' +
      '&scope=email profile' +
      `&state=${state}`;

    return res.redirect(url);
  }

  @Get('login-google/callback')
  @HttpCode(OAuthResponse.LOGIN_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '구글 OAuth 정보 가져오기' })
  @SwaggerApiOkResponse({
    status: OAuthResponse.LOGIN_SUCCESS.statusCode,
    description: `Google ${OAuthResponse.LOGIN_SUCCESS.message}`,
    dto: AuthLoginResponseDto,
  })
  @SwaggerApiErrorResponse({
    status: OAuthError.LOGIN_ERROR.statusCode,
    description: `Google ${OAuthError.LOGIN_ERROR.message}`,
  })
  @UseGuards(GoogleOAuthStateGuard)
  @UseInterceptors(TransactionInterceptor)
  @Serialize({
    dto: AuthLoginResponseDto,
    code: OAuthResponse.LOGIN_SUCCESS.code,
    message: `Google ${OAuthResponse.LOGIN_SUCCESS.message}`,
  })
  async loginGoogleCallback(
    @Res() res: Response,
    @Query() query: GoogleOAuthCallbackQueryDto,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<void> {
    const redirectUrl = await this.oauthService.loginGoogle(res, transactionManager, query);

    return res.redirect(redirectUrl);
  }

  @Get('/login-naver')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '네이버 로그인' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '네이버 로그인 OAuth로 redirect 성공',
  })
  async loginNaver(
    @Res() res: Response,
    @Query('redirect-session') redirectSession?: string
  ): Promise<void> {
    const state = await this.oauthService.generateState(
      OAuthAccountProviderType.NAVER,
      redirectSession
    );
    const clientId = this.configService.get<NaverConfig['clientId']>('naver.clientId');
    const redirectUrl = this.configService.get<NaverConfig['redirectUrl']>('naver.redirectUrl');

    const url =
      'https://nid.naver.com/oauth2.0/authorize' +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUrl}` +
      '&response_type=code' +
      `&state=${state}`;

    return res.redirect(url);
  }

  @Get('/login-naver/callback')
  @HttpCode(OAuthResponse.LOGIN_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '네이버 OAuth 정보 가져오기' })
  @SwaggerApiOkResponse({
    status: OAuthResponse.LOGIN_SUCCESS.statusCode,
    description: `Naver ${OAuthResponse.LOGIN_SUCCESS.message}`,
    dto: AuthLoginResponseDto,
  })
  @SwaggerApiErrorResponse({
    status: OAuthError.LOGIN_ERROR.statusCode,
    description: `Naver ${OAuthError.LOGIN_ERROR.message}`,
  })
  @UseGuards(NaverOAuthStateGuard)
  @UseInterceptors(TransactionInterceptor)
  @Serialize({
    dto: AuthLoginResponseDto,
    code: OAuthResponse.LOGIN_SUCCESS.code,
    message: `Naver ${OAuthResponse.LOGIN_SUCCESS.message}`,
  })
  async loginNaverCallback(
    @Res() res: Response,
    @Query() query: NaverOAuthCallbackQueryDto,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<void> {
    const redirectUrl = await this.oauthService.loginNaver(res, transactionManager, query);

    return res.redirect(redirectUrl);
  }
}

