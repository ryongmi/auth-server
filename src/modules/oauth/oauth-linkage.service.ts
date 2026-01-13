import { Injectable, Logger } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import type {
  NaverUserProfileResponse,
  GoogleUserProfileResponse,
  NaverTokenResponse,
  GoogleTokenResponse,
} from '@krgeobuk/oauth/interfaces';
import { OAuthException } from '@krgeobuk/oauth/exception';

import { UserService } from '@modules/user/index.js';
import { AccountMergeService } from '@modules/account-merge/account-merge.service.js';

import { OAuthAccountEntity } from './entities/oauth-account.entity.js';
import { OAuthTokenService } from './oauth-token.service.js';
import { OAuthRepository } from './oauth.repository.js';
import { OAuthService } from './oauth.service.js';

/**
 * OAuth 계정 연동/연동 해제 서비스
 * OAuth 계정의 연결 및 해제 관련 비즈니스 로직 처리
 */
@Injectable()
export class OAuthLinkageService {
  private readonly logger = new Logger(OAuthLinkageService.name);

  constructor(
    private readonly userService: UserService,
    private readonly oauthTokenService: OAuthTokenService,
    private readonly oauthRepo: OAuthRepository,
    private readonly accountMergeService: AccountMergeService,
    private readonly oauthService: OAuthService
  ) {}

  /**
   * 사용자가 연동한 OAuth 계정 목록 조회
   * @param userId - 사용자 ID
   * @returns OAuth 계정 목록
   */
  async getLinkedAccounts(userId: string): Promise<OAuthAccountEntity[]> {
    this.logger.log(`${this.getLinkedAccounts.name} - userId: ${userId}`);
    return this.oauthService.findByAnd({ userId });
  }

  /**
   * OAuth 계정 연동 해제
   * 최소 1개의 로그인 방식은 유지되어야 함
   * @param userId - 사용자 ID
   * @param provider - OAuth 제공자 타입
   */
  async unlinkOAuthAccount(userId: string, provider: OAuthAccountProviderType): Promise<void> {
    this.logger.log(`${this.unlinkOAuthAccount.name} - userId: ${userId}, provider: ${provider}`);

    // provider 검증
    if (!Object.values(OAuthAccountProviderType).includes(provider)) {
      throw OAuthException.unsupportedProvider(provider);
    }

    // 1. 현재 연동된 계정 개수 확인
    const linkedAccounts = await this.getLinkedAccounts(userId);

    if (linkedAccounts.length <= 1) {
      throw OAuthException.cannotUnlinkLastAccount();
    }

    // 2. 해당 provider 연동 해제
    const targetAccount = linkedAccounts.find((acc) => acc.provider === provider);

    if (!targetAccount) {
      throw OAuthException.providerNotLinked(provider);
    }

    await this.oauthRepo.delete(targetAccount.id);

    this.logger.log(`${this.unlinkOAuthAccount.name} - 성공적으로 종료되었습니다.`);
  }

  /**
   * OAuth 계정 연동 (이미 로그인된 사용자가 추가 OAuth provider 연결)
   * @param userId - 사용자 ID
   * @param provider - OAuth 제공자 타입
   * @param userInfo - OAuth 제공자의 사용자 정보
   * @param tokenData - OAuth 제공자의 토큰 데이터
   * @param transactionManager - TypeORM 트랜잭션 매니저
   * @returns 연동된 OAuth 계정 엔티티
   */
  async linkOAuthAccount(
    userId: string,
    provider: OAuthAccountProviderType,
    userInfo: NaverUserProfileResponse | GoogleUserProfileResponse,
    tokenData: NaverTokenResponse | GoogleTokenResponse,
    transactionManager?: EntityManager
  ): Promise<OAuthAccountEntity> {
    this.logger.log(`${this.linkOAuthAccount.name} - userId: ${userId}, provider: ${provider}`);

    // 1. 이미 해당 provider가 다른 유저에게 연동되어 있는지 확인
    const existingOAuth = await this.oauthService.findByAnd({ providerId: userInfo.id, provider });

    if (existingOAuth.length > 0 && existingOAuth[0]?.userId !== userId) {
      const existingAccount = existingOAuth[0];
      if (existingAccount) {
        // OAuth 계정이 다른 사용자에게 이미 연결되어 있음
        // 자동으로 계정 병합 요청 생성
        const existingUserId = existingAccount.userId;

        // 기존 사용자(User B)의 이메일 조회
        const existingUser = await this.userService.findById(existingUserId);
        if (existingUser) {
          // 계정 병합 요청 생성 및 이메일 전송
          await this.accountMergeService.initiateAccountMerge(
            provider,
            userInfo.id,
            existingUser.email,
            userId // sourceUserId (OAuth 연동을 시도하는 사용자)
          );

          this.logger.log(`${this.linkOAuthAccount.name} - 계정 병합 요청 생성 완료`);
        }
      }

      // 병합 요청 생성 후 특별한 예외를 던져서 클라이언트에 알림
      throw OAuthException.alreadyLinkedToAnotherAccount(provider);
    }

    // 2. 이미 현재 유저에게 연동되어 있는지 확인
    if (existingOAuth.length > 0 && existingOAuth[0]?.userId === userId) {
      throw OAuthException.providerAlreadyLinked(provider);
    }

    // 3. OAuth 계정 연동
    const tokenAttributes = this.oauthTokenService.buildTokenAttributes(tokenData);
    const oauthAccountAttrs: Partial<OAuthAccountEntity> = {
      userId,
      provider,
      providerId: userInfo.id,
      ...tokenAttributes,
    };

    const linkedAccount = await this.oauthService.createOAuthAccount(
      oauthAccountAttrs,
      transactionManager
    );

    this.logger.log(`${this.linkOAuthAccount.name} - 성공적으로 종료되었습니다.`);

    return linkedAccount;
  }
}
