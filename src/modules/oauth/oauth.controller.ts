import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpException,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EntityManager } from 'typeorm';
import { Response } from 'express';

import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
import { TransactionManager } from '@krgeobuk/core/decorators';
import { NaverOAuthCallbackQueryDto, GoogleOAuthCallbackQueryDto } from '@krgeobuk/oauth/dtos';
import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import { OAuthError } from '@krgeobuk/oauth/exception';
import { OAuthResponse } from '@krgeobuk/oauth/response';
import { OauthStateMode } from '@krgeobuk/oauth/enum';
import '@krgeobuk/core/interfaces/express';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiBody,
} from '@krgeobuk/swagger/decorators';
import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';

import { GoogleConfig, NaverConfig } from '@common/interfaces/index.js';
import { RefreshTokenGuard } from '@common/jwt/guards/index.js';

import { NaverOAuthStateGuard, GoogleOAuthStateGuard } from './guards/oauth-state.guard.js';
import { OAuthService } from './oauth.service.js';

@SwaggerApiTags({ tags: ['oauth'] })
@Controller('oauth')
export class OAuthController {
  constructor(
    private configService: ConfigService,
    private oauthService: OAuthService
  ) {}

  /**
   * OAuth 에러 발생 시 적절한 페이지로 리다이렉트
   * @param mode - OAuth 모드 (LOGIN 또는 LINK)
   * @param errorCode - 에러 코드 (예: 'OAUTH_101')
   * @param errorDetails - OAUTH_205 등 상세 정보가 필요한 에러의 추가 데이터
   * @returns 리다이렉트할 URL
   */
  private getErrorRedirectUrl(
    mode: OauthStateMode | string,
    errorCode: string,
    errorDetails?: {
      email?: string;
      attemptedProvider?: string;
      availableLoginMethods?: string[];
      suggestion?: string;
    }
  ): string {
    const authClientUrl = this.configService.get('authClientUrl') || 'http://localhost:3000';
    const basePath = mode === OauthStateMode.LINK ? '/settings/accounts' : '/login';

    // 기본 파라미터
    const params = new URLSearchParams({ error: errorCode });

    // OAUTH_205 (이메일 중복) 에러는 상세 정보 추가
    if (errorCode === 'OAUTH_205' && errorDetails) {
      if (errorDetails.attemptedProvider) {
        params.append('provider', errorDetails.attemptedProvider);
      }
      if (errorDetails.email) {
        params.append('email', errorDetails.email);
      }
      if (errorDetails.availableLoginMethods && errorDetails.availableLoginMethods.length > 0) {
        params.append('methods', errorDetails.availableLoginMethods.join(','));
      }
      if (errorDetails.suggestion) {
        params.append('suggestion', errorDetails.suggestion);
      }
    }

    return `${authClientUrl}${basePath}?${params.toString()}`;
  }

  @Get('login-google')
  @HttpCode(OAuthResponse.OAUTH_LOGIN_START_REDIRECT.statusCode)
  @SwaggerApiOperation({ summary: 'Google OAuth SSO 시작' })
  @SwaggerApiOkResponse({
    status: OAuthResponse.OAUTH_LOGIN_START_REDIRECT.statusCode,
    description: OAuthResponse.OAUTH_LOGIN_START_REDIRECT.message,
  })
  async loginGoogle(
    @Res() res: Response,
    @Query('redirect_session') redirectSession: string
  ): Promise<void> {
    const stateData = JSON.stringify({
      mode: OauthStateMode.LOGIN,
      redirectSession,
    });
    const state = await this.oauthService.generateState(OAuthAccountProviderType.GOOGLE, stateData);
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
  @HttpCode(OAuthResponse.GOOGLE_SSO_REDIRECT.statusCode)
  @SwaggerApiOperation({ summary: 'Google OAuth SSO 콜백 처리' })
  @SwaggerApiOkResponse({
    status: OAuthResponse.GOOGLE_SSO_REDIRECT.statusCode,
    description: OAuthResponse.GOOGLE_SSO_REDIRECT.message,
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
    try {
      const redirectUrl = await this.oauthService.loginGoogle(res, transactionManager, query);
      return res.redirect(redirectUrl);
    } catch (error) {
      // 에러 코드 및 상세 정보 추출
      let errorCode = 'OAUTH_003'; // LOGIN_ERROR 기본값
      let errorDetails;

      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null && 'code' in response) {
          errorCode = (response as { code: string }).code;

          // OAUTH_205 에러의 상세 정보 추출
          if (errorCode === 'OAUTH_205' && 'details' in response) {
            errorDetails = {
              ...(response as any).details,
              attemptedProvider: 'google',
            };
          }
        }
      }

      // stateData에서 mode 추출 (에러 상황에서도 state를 읽을 수 있다면)
      let mode: OauthStateMode | string = OauthStateMode.LOGIN; // 기본값
      try {
        const stateData = await this.oauthService.getStateData(
          query.state,
          OAuthAccountProviderType.GOOGLE
        );
        if (stateData?.mode) {
          mode = stateData.mode as OauthStateMode;
        }
      } catch {
        // state 조회 실패 시 기본값 사용
      }

      // 에러 코드 및 상세 정보를 포함한 URL로 리다이렉트
      const redirectUrl = this.getErrorRedirectUrl(mode, errorCode, errorDetails);
      return res.redirect(redirectUrl);
    }
  }

  @Get('/login-naver')
  @HttpCode(OAuthResponse.OAUTH_LOGIN_START_REDIRECT.statusCode)
  @SwaggerApiOperation({ summary: 'Naver OAuth SSO 시작' })
  @SwaggerApiOkResponse({
    status: OAuthResponse.OAUTH_LOGIN_START_REDIRECT.statusCode,
    description: OAuthResponse.OAUTH_LOGIN_START_REDIRECT.message,
  })
  async loginNaver(
    @Res() res: Response,
    @Query('redirect_session') redirectSession: string
  ): Promise<void> {
    const stateData = JSON.stringify({
      mode: OauthStateMode.LOGIN,
      redirectSession,
    });
    const state = await this.oauthService.generateState(OAuthAccountProviderType.NAVER, stateData);
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
  @HttpCode(OAuthResponse.NAVER_SSO_REDIRECT.statusCode)
  @SwaggerApiOperation({ summary: 'Naver OAuth SSO 콜백 처리' })
  @SwaggerApiOkResponse({
    status: OAuthResponse.NAVER_SSO_REDIRECT.statusCode,
    description: OAuthResponse.NAVER_SSO_REDIRECT.message,
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
    try {
      const redirectUrl = await this.oauthService.loginNaver(res, transactionManager, query);
      return res.redirect(redirectUrl);
    } catch (error) {
      // 에러 코드 및 상세 정보 추출
      let errorCode = 'OAUTH_003'; // LOGIN_ERROR 기본값
      let errorDetails;

      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null && 'code' in response) {
          errorCode = (response as { code: string }).code;

          // OAUTH_205 에러의 상세 정보 추출
          if (errorCode === 'OAUTH_205' && 'details' in response) {
            errorDetails = {
              ...(response as any).details,
              attemptedProvider: 'naver',
            };
          }
        }
      }

      // stateData에서 mode 추출
      let mode: OauthStateMode | string = OauthStateMode.LOGIN; // 기본값
      try {
        const stateData = await this.oauthService.getStateData(
          query.state,
          OAuthAccountProviderType.NAVER
        );
        if (stateData?.mode) {
          mode = stateData.mode as OauthStateMode;
        }
      } catch {
        // state 조회 실패 시 기본값 사용
      }

      // 에러 코드 및 상세 정보를 포함한 URL로 리다이렉트
      const redirectUrl = this.getErrorRedirectUrl(mode, errorCode, errorDetails);
      return res.redirect(redirectUrl);
    }
  }

  /**
   * OAuth 계정 연동 엔드포인트
   * 로그인된 사용자가 추가 OAuth provider를 연결할 때 사용
   */

  @Get('link-google')
  @HttpCode(OAuthResponse.GOOGLE_LINK_START_REDIRECT.statusCode)
  @SwaggerApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @SwaggerApiOperation({ summary: 'Google OAuth 계정 연동 시작' })
  @SwaggerApiOkResponse({
    status: OAuthResponse.GOOGLE_LINK_START_REDIRECT.statusCode,
    description: OAuthResponse.GOOGLE_LINK_START_REDIRECT.message,
  })
  async linkGoogle(
    @Res() res: Response,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<void> {
    // state에 mode와 userId만 포함
    const stateData = JSON.stringify({
      mode: OauthStateMode.LINK,
      userId,
    });
    const state = await this.oauthService.generateState(OAuthAccountProviderType.GOOGLE, stateData);

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

  @Get('link-naver')
  @HttpCode(OAuthResponse.NAVER_LINK_START_REDIRECT.statusCode)
  @SwaggerApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @SwaggerApiOperation({ summary: 'Naver OAuth 계정 연동 시작' })
  @SwaggerApiOkResponse({
    status: OAuthResponse.NAVER_LINK_START_REDIRECT.statusCode,
    description: OAuthResponse.NAVER_LINK_START_REDIRECT.message,
  })
  async linkNaver(
    @Res() res: Response,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<void> {
    // state에 mode와 userId만 포함
    const stateData = JSON.stringify({
      mode: OauthStateMode.LINK,
      userId,
    });
    const state = await this.oauthService.generateState(OAuthAccountProviderType.NAVER, stateData);

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
}
