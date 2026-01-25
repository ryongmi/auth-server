import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import { lastValueFrom, map } from 'rxjs';

import type { GoogleTokenResponse, NaverTokenResponse } from '@krgeobuk/oauth/interfaces';
import { OAuthException } from '@krgeobuk/oauth/exception';
import type { TcpYouTubeTokenResult } from '@krgeobuk/oauth/tcp/interfaces';
import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import { GoogleTokenResponseDto } from '@krgeobuk/oauth/dtos';
import { transformAndValidate } from '@krgeobuk/core/utils';

import { CryptoService } from '@common/crypto/index.js';
import type { GoogleConfig } from '@common/interfaces/index.js';

import type { OAuthAccountEntity } from './entities/oauth-account.entity.js';
import { OAuthRepository } from './oauth.repository.js';

/**
 * OAuth 토큰 관리 서비스
 * OAuth 제공자로부터 받은 토큰 데이터를 OAuthAccountEntity 속성으로 변환
 * 토큰은 AES-256-CBC로 암호화하여 저장
 */
@Injectable()
export class OAuthTokenService {
  private readonly logger = new Logger(OAuthTokenService.name);

  constructor(
    private readonly cryptoService: CryptoService,
    private readonly oauthRepo: OAuthRepository,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

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

  // ==================== YouTube 토큰 조회/갱신 ====================

  /**
   * YouTube 액세스 토큰 조회 (자동 갱신 포함)
   * @param userId - 사용자 ID
   * @returns 복호화된 액세스 토큰 및 만료 시간
   */
  async getYouTubeAccessToken(userId: string): Promise<TcpYouTubeTokenResult> {
    this.logger.debug(`YouTube 토큰 조회 시작 - userId: ${userId}`);

    const oauth = await this.oauthRepo.findOne({
      where: { userId, provider: OAuthAccountProviderType.GOOGLE },
    });

    if (!oauth?.accessToken) {
      this.logger.warn(`YouTube 토큰 없음 - userId: ${userId}`);
      throw OAuthException.tokenNotFound(OAuthAccountProviderType.GOOGLE);
    }

    // 토큰 만료 확인 (5분 버퍼)
    const expiryBuffer = new Date(Date.now() + 5 * 60 * 1000);
    if (oauth.tokenExpiresAt && oauth.tokenExpiresAt < expiryBuffer) {
      this.logger.log(
        `토큰 만료 임박, 갱신 시작 - userId: ${userId}, expiresAt: ${oauth.tokenExpiresAt}`
      );
      await this.refreshGoogleToken(oauth);
    }

    const accessToken = this.cryptoService.decrypt(oauth.accessToken);

    this.logger.debug(`YouTube 토큰 조회 완료 - userId: ${userId}`);

    return {
      accessToken,
      expiresAt: oauth.tokenExpiresAt!,
    };
  }

  /**
   * 사용자의 YouTube 권한 여부 확인
   * @param userId - 사용자 ID
   * @returns YouTube 권한 여부
   */
  async hasYouTubeAccess(userId: string): Promise<boolean> {
    const oauth = await this.oauthRepo.findOne({
      where: { userId, provider: OAuthAccountProviderType.GOOGLE },
    });

    const hasAccess = !!(oauth?.accessToken && oauth?.scopes?.includes('youtube'));

    this.logger.debug(`YouTube 권한 확인 - userId: ${userId}, hasAccess: ${hasAccess}`);

    return hasAccess;
  }

  /**
   * Google OAuth 토큰 갱신
   * @param oauth - OAuth 계정 엔티티
   */
  private async refreshGoogleToken(oauth: OAuthAccountEntity): Promise<void> {
    if (!oauth.refreshToken) {
      this.logger.error(`Refresh Token 없음 - userId: ${oauth.userId}`);
      throw OAuthException.refreshTokenNotFound(OAuthAccountProviderType.GOOGLE);
    }

    const refreshToken = this.cryptoService.decrypt(oauth.refreshToken);
    const googleConfig = this.configService.get<GoogleConfig>('google')!;

    try {
      const response = await lastValueFrom(
        this.httpService
          .post(googleConfig.tokenUrl, {
            client_id: googleConfig.clientId,
            client_secret: googleConfig.clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          })
          .pipe(map((res) => res.data))
      );

      this.logger.log(`Google 토큰 갱신 성공 - userId: ${oauth.userId}`);

      // 변환 + 유효성 검사
      const tokenData = await transformAndValidate<GoogleTokenResponseDto>({
        cls: GoogleTokenResponseDto,
        plain: response,
      });

      // 새 토큰 저장
      oauth.accessToken = this.cryptoService.encrypt(tokenData.accessToken);
      oauth.tokenExpiresAt = new Date(Date.now() + tokenData.expiresIn * 1000);

      // refreshToken이 갱신되었다면 업데이트
      if (tokenData.refreshToken) {
        oauth.refreshToken = this.cryptoService.encrypt(tokenData.refreshToken);
      }

      await this.oauthRepo.save(oauth);

      this.logger.log(
        `토큰 갱신 DB 저장 완료 - userId: ${oauth.userId}, expiresAt: ${oauth.tokenExpiresAt}`
      );
    } catch (error) {
      this.logger.error('Google 토큰 갱신 실패', {
        userId: oauth.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw OAuthException.tokenRefreshFailed(OAuthAccountProviderType.GOOGLE);
    }
  }
}
