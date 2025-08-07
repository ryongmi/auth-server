import { Injectable } from '@nestjs/common';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';

import { OAuthService } from '../oauth.service.js';

import { BaseOAuthStateGuard } from './base-oauth-state.guard.js';

/**
 * Naver OAuth State 검증 가드
 * BaseOAuthStateGuard를 상속받아 Naver 특화 에러 처리를 구현
 */
@Injectable()
export class NaverOAuthStateGuard extends BaseOAuthStateGuard {
  constructor(oauthService: OAuthService) {
    super(oauthService, OAuthAccountProviderType.NAVER);
  }

  /**
   * Naver OAuth 에러 처리
   * error_description을 포함한 상세 에러 로깅
   */
  protected handleOAuthError(error: string, query: Record<string, unknown>): void {
    const { error_description } = query;
    const message = `[NAVER_OAUTH_ERROR] Error: ${error}, ErrorMsg: ${error_description || 'No description'}`;

    this.logger.error(message, {
      provider: 'NAVER',
      error,
      error_description,
      action: 'oauth_callback',
    });
  }
}

/**
 * Google OAuth State 검증 가드
 * BaseOAuthStateGuard를 상속받아 Google 특화 에러 처리를 구현
 */
@Injectable()
export class GoogleOAuthStateGuard extends BaseOAuthStateGuard {
  constructor(oauthService: OAuthService) {
    super(oauthService, OAuthAccountProviderType.GOOGLE);
  }

  /**
   * Google OAuth 에러 처리
   * 기본적인 에러 정보만 로깅
   */
  protected handleOAuthError(error: string, _query: Record<string, unknown>): void {
    const message = `[GOOGLE_OAUTH_ERROR] Error: ${error}`;

    this.logger.error(message, {
      provider: 'GOOGLE',
      error,
      action: 'oauth_callback',
    });
  }
}
