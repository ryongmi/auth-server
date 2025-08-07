import { Controller, Get, HttpCode, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EntityManager } from 'typeorm';
import { Response } from 'express';

import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
import { TransactionManager } from '@krgeobuk/core/decorators';
import { NaverOAuthCallbackQueryDto, GoogleOAuthCallbackQueryDto } from '@krgeobuk/oauth/dtos';
import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
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
  @HttpCode(302)
  @SwaggerApiOperation({ summary: 'Google OAuth SSO 시작' })
  @SwaggerApiOkResponse({
    status: 302,
    description: 'Google OAuth 인증 페이지로 리다이렉트',
  })
  async loginGoogle(
    @Res() res: Response,
    @Query('redirect_session') redirectSession: string
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
  @HttpCode(302)
  @SwaggerApiOperation({ summary: 'Google OAuth SSO 콜백 처리' })
  @SwaggerApiOkResponse({
    status: 302,
    description: 'Google 로그인 성공 후 원래 서비스로 리다이렉트',
  })
  @SwaggerApiErrorResponse({
    status: OAuthError.LOGIN_ERROR.statusCode,
    description: `Google ${OAuthError.LOGIN_ERROR.message}`,
  })
  @UseGuards(GoogleOAuthStateGuard)
  @UseInterceptors(TransactionInterceptor)
  async loginGoogleCallback(
    @Res() res: Response,
    @Query() query: GoogleOAuthCallbackQueryDto,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<void> {
    const redirectUrl = await this.oauthService.loginGoogle(res, transactionManager, query);
    return res.redirect(redirectUrl);
  }

  @Get('/login-naver')
  @HttpCode(302)
  @SwaggerApiOperation({ summary: 'Naver OAuth SSO 시작' })
  @SwaggerApiOkResponse({
    status: 302,
    description: 'Naver OAuth 인증 페이지로 리다이렉트',
  })
  async loginNaver(
    @Res() res: Response,
    @Query('redirect_session') redirectSession: string
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
  @HttpCode(302)
  @SwaggerApiOperation({ summary: 'Naver OAuth SSO 콜백 처리' })
  @SwaggerApiOkResponse({
    status: 302,
    description: 'Naver 로그인 성공 후 원래 서비스로 리다이렉트',
  })
  @SwaggerApiErrorResponse({
    status: OAuthError.LOGIN_ERROR.statusCode,
    description: `Naver ${OAuthError.LOGIN_ERROR.message}`,
  })
  @UseGuards(NaverOAuthStateGuard)
  @UseInterceptors(TransactionInterceptor)
  async loginNaverCallback(
    @Res() res: Response,
    @Query() query: NaverOAuthCallbackQueryDto,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<void> {
    const redirectUrl = await this.oauthService.loginNaver(res, transactionManager, query);
    return res.redirect(redirectUrl);
  }
}

