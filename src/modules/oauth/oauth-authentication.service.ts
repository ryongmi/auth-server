import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EntityManager } from 'typeorm';
import { Response } from 'express';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import type {
  NaverOAuthCallbackQuery,
  GoogleOAuthCallbackQuery,
  NaverUserProfileResponse,
  GoogleUserProfileResponse,
  NaverTokenResponse,
  GoogleTokenResponse,
} from '@krgeobuk/oauth/interfaces';
import { OAuthException } from '@krgeobuk/oauth/exception';
import { OauthStateMode } from '@krgeobuk/oauth/enum';

import { JwtTokenService } from '@common/jwt/index.js';
import type { DefaultConfig } from '@common/interfaces/config.interfaces.js';
import { RedisService } from '@database/redis/redis.service.js';

import { GoogleOAuthService } from './google.service.js';
import { NaverOAuthService } from './naver.service.js';
import { OAuthLinkageService } from './oauth-linkage.service.js';
import { OAuthUserService } from './oauth-user.service.js';

/**
 * OAuth 인증 처리 서비스
 * Google/Naver OAuth 콜백의 공통 로직을 통합 처리
 */
@Injectable()
export class OAuthAuthenticationService {
  private readonly logger = new Logger(OAuthAuthenticationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtTokenService,
    private readonly redisService: RedisService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly naverOAuthService: NaverOAuthService,
    @Inject(forwardRef(() => OAuthLinkageService))
    private readonly oauthLinkageService: OAuthLinkageService,
    @Inject(forwardRef(() => OAuthUserService))
    private readonly oauthUserService: OAuthUserService
  ) {}

  /**
   * OAuth 인증 프로세스 처리
   * @param provider - OAuth 제공자 타입
   * @param res - Express Response 객체
   * @param query - OAuth 콜백 쿼리 파라미터
   * @param stateData - State에서 파싱된 데이터
   * @param transactionManager - TypeORM 트랜잭션 매니저
   * @returns 리다이렉트 URL
   */
  async authenticate(
    provider: OAuthAccountProviderType,
    res: Response,
    query: NaverOAuthCallbackQuery | GoogleOAuthCallbackQuery,
    stateData: {
      mode?: string;
      userId?: string;
      redirectSession?: string;
    },
    transactionManager: EntityManager
  ): Promise<string> {
    this.logger.log(`${this.authenticate.name} - 시작: provider=${provider}`);

    // Provider별 사용자 정보 가져오기
    const { userInfo, tokenData } = await this.getUserInfo(provider, query);

    // 계정 연동 모드인 경우
    if (stateData.mode === OauthStateMode.LINK) {
      await this.oauthLinkageService.linkOAuthAccount(
        stateData.userId!,
        provider,
        userInfo,
        tokenData,
        transactionManager
      );

      // 연동 완료 후 계정 설정 페이지로 리다이렉트
      const authClientUrl = this.configService.get<DefaultConfig['authClientUrl']>('authClientUrl')!;

      return `${authClientUrl}/settings/accounts?linked=true&provider=${provider}`;
    }

    // 일반 로그인 모드
    if (stateData.mode === OauthStateMode.LOGIN) {
      const user = await this.oauthUserService.authenticateOAuthUser(
        userInfo,
        provider,
        tokenData,
        transactionManager
      );

      // JWT 토큰 발급
      const payload = {
        sub: user.id,
        tokenData,
      };

      const { refreshToken } = await this.jwtService.signAccessTokenAndRefreshToken(payload);
      this.jwtService.setRefreshTokenToCookie(res, refreshToken);

      // SSO 리다이렉트 처리
      if (stateData.redirectSession) {
        const sessionData = await this.redisService.getRedirectSession(stateData.redirectSession);
        if (sessionData) {
          await this.redisService.deleteRedirectSession(stateData.redirectSession);
          this.logger.log(`${this.authenticate.name} - SSO 리다이렉트 성공`);
          return sessionData.redirectUri;
        }
      }

      const portalClientUrl =
        this.configService.get<DefaultConfig['portalClientUrl']>('portalClientUrl')!;

      this.logger.log(`${this.authenticate.name} - 성공적으로 종료되었습니다.`);

      return portalClientUrl;
    }

    // 잘못된 mode
    throw OAuthException.invalidState();
  }

  /**
   * Provider별 사용자 정보 가져오기
   */
  private async getUserInfo(
    provider: OAuthAccountProviderType,
    query: NaverOAuthCallbackQuery | GoogleOAuthCallbackQuery
  ): Promise<{
    userInfo: NaverUserProfileResponse | GoogleUserProfileResponse;
    tokenData: NaverTokenResponse | GoogleTokenResponse;
  }> {
    if (provider === OAuthAccountProviderType.NAVER) {
      const { tokenData, naverUserInfo } = await this.naverOAuthService.getNaverUserInfo(query);
      return { userInfo: naverUserInfo, tokenData };
    } else if (provider === OAuthAccountProviderType.GOOGLE) {
      const { tokenData, googleUserInfo } = await this.googleOAuthService.getGoogleUserInfo(query);
      return { userInfo: googleUserInfo, tokenData };
    } else {
      throw OAuthException.unsupportedProvider(provider);
    }
  }
}
