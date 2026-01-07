import { Injectable, Logger } from '@nestjs/common';

import type {
  GoogleTokenResponse,
  NaverTokenResponse,
} from '@krgeobuk/oauth/interfaces';

import type { OAuthAccountEntity } from './entities/oauth-account.entity.js';

/**
 * OAuth 토큰 관리 서비스
 * OAuth 제공자로부터 받은 토큰 데이터를 OAuthAccountEntity 속성으로 변환
 */
@Injectable()
export class OAuthTokenService {
  private readonly logger = new Logger(OAuthTokenService.name);

  /**
   * OAuth 토큰 데이터를 OAuthAccountEntity 속성으로 변환
   * @param tokenData - OAuth 제공자로부터 받은 토큰 응답
   * @returns OAuthAccountEntity의 토큰 관련 속성
   */
  buildTokenAttributes(
    tokenData: NaverTokenResponse | GoogleTokenResponse
  ): Pick<OAuthAccountEntity, 'accessToken' | 'refreshToken' | 'tokenExpiresAt' | 'scopes'> {
    this.logger.log(`${this.buildTokenAttributes.name} - 토큰 속성 빌드 시작`);

    const attributes = {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken ?? null,
      tokenExpiresAt: tokenData.expiresIn
        ? new Date(Date.now() + tokenData.expiresIn * 1000)
        : null,
      scopes: 'scope' in tokenData ? tokenData.scope : null,
    };

    this.logger.log(`${this.buildTokenAttributes.name} - 토큰 속성 빌드 완료`);

    return attributes;
  }
}
