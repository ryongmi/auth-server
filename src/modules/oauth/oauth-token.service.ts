import { Injectable, Logger } from '@nestjs/common';

import type {
  GoogleTokenResponse,
  NaverTokenResponse,
} from '@krgeobuk/oauth/interfaces';

import { CryptoService } from '@common/crypto/index.js';

import type { OAuthAccountEntity } from './entities/oauth-account.entity.js';

/**
 * OAuth 토큰 관리 서비스
 * OAuth 제공자로부터 받은 토큰 데이터를 OAuthAccountEntity 속성으로 변환
 * 토큰은 AES-256-CBC로 암호화하여 저장
 */
@Injectable()
export class OAuthTokenService {
  private readonly logger = new Logger(OAuthTokenService.name);

  constructor(private readonly cryptoService: CryptoService) {}

  /**
   * OAuth 토큰 데이터를 OAuthAccountEntity 속성으로 변환 (암호화 적용)
   * @param tokenData - OAuth 제공자로부터 받은 토큰 응답
   * @returns OAuthAccountEntity의 토큰 관련 속성 (암호화된 토큰)
   */
  buildTokenAttributes(
    tokenData: NaverTokenResponse | GoogleTokenResponse
  ): Pick<OAuthAccountEntity, 'accessToken' | 'refreshToken' | 'tokenExpiresAt' | 'scopes'> {
    this.logger.log(`${this.buildTokenAttributes.name} - 토큰 속성 빌드 시작 (암호화 적용)`);

    const attributes = {
      accessToken: this.cryptoService.encrypt(tokenData.accessToken),
      refreshToken: tokenData.refreshToken
        ? this.cryptoService.encrypt(tokenData.refreshToken)
        : null,
      tokenExpiresAt: tokenData.expiresIn
        ? new Date(Date.now() + tokenData.expiresIn * 1000)
        : null,
      scopes: 'scope' in tokenData ? tokenData.scope : null,
    };

    this.logger.log(`${this.buildTokenAttributes.name} - 토큰 속성 빌드 완료 (암호화됨)`);

    return attributes;
  }

  /**
   * 암호화된 액세스 토큰 복호화
   * @param encryptedToken - 암호화된 토큰
   * @returns 복호화된 토큰
   */
  decryptAccessToken(encryptedToken: string): string {
    return this.cryptoService.decrypt(encryptedToken);
  }

  /**
   * 암호화된 리프레시 토큰 복호화
   * @param encryptedToken - 암호화된 토큰
   * @returns 복호화된 토큰
   */
  decryptRefreshToken(encryptedToken: string): string {
    return this.cryptoService.decrypt(encryptedToken);
  }
}
