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
import { UserException } from '@krgeobuk/user/exception';

import { UserEntity, UserService } from '@modules/user/index.js';

import { OAuthTokenService } from './oauth-token.service.js';
import { OAuthService } from './oauth.service.js';

/**
 * OAuth 사용자 인증 서비스
 * OAuth 로그인 시 사용자 조회, 생성, OAuth 계정 연동 처리
 */
@Injectable()
export class OAuthUserService {
  private readonly logger = new Logger(OAuthUserService.name);

  constructor(
    private readonly userService: UserService,
    private readonly oauthTokenService: OAuthTokenService,
    private readonly oauthService: OAuthService
  ) {}

  /**
   * OAuth 사용자 인증
   * 기존 OAuth 계정이면 토큰 업데이트, 신규면 회원가입 처리
   *
   * @param userInfo - OAuth 제공자의 사용자 정보
   * @param provider - OAuth 제공자 타입
   * @param tokenData - OAuth 제공자의 토큰 데이터
   * @param transactionManager - TypeORM 트랜잭션 매니저
   * @returns 인증된 사용자 엔티티
   */
  async authenticateOAuthUser(
    userInfo: NaverUserProfileResponse | GoogleUserProfileResponse,
    provider: OAuthAccountProviderType,
    tokenData: NaverTokenResponse | GoogleTokenResponse,
    transactionManager: EntityManager
  ): Promise<UserEntity> {
    this.logger.log(`${this.authenticateOAuthUser.name} - 시작 되었습니다.`);

    // ✅ OAuth ID 우선 조회 (가장 신뢰할 수 있는 식별자)
    const oauth = (await this.oauthService.findByAnd({ provider, providerId: userInfo.id }))[0];

    let user: UserEntity | null;

    if (oauth) {
      // 🔹 기존 OAuth 계정 발견 - userId로 사용자 조회
      this.logger.log(
        `${this.authenticateOAuthUser.name} - 기존 OAuth 계정 발견. provider: ${provider}, providerId: ${userInfo.id}`
      );

      user = await this.userService.findById(oauth.userId);

      if (!user) {
        // OAuth는 존재하는데 User가 없는 경우 (데이터 정합성 오류)
        this.logger.error(
          `${this.authenticateOAuthUser.name} - OAuth 계정은 존재하나 User를 찾을 수 없습니다. userId: ${oauth.userId}`
        );
        throw UserException.userNotFound();
      }

      // OAuth 토큰 정보 업데이트
      const tokenAttributes = this.oauthTokenService.buildTokenAttributes(tokenData);

      Object.assign(oauth, tokenAttributes);
      await this.oauthService.updateOAuthAccount(oauth, transactionManager);

      this.logger.log(
        `${this.authenticateOAuthUser.name} - OAuth 토큰 업데이트 완료. userId: ${user.id}`
      );
    } else {
      // 🔹 새로운 OAuth 계정 - 이메일 중복 체크 필요
      this.logger.log(
        `${this.authenticateOAuthUser.name} - 신규 OAuth 계정. provider: ${provider}, providerId: ${userInfo.id}`
      );

      // ✅ 1. 이메일로 기존 사용자 조회
      const existingUser = await this.userService.findByEmail(userInfo.email);

      if (existingUser) {
        // ✅ 2. 기존 사용자가 있으면 연동된 OAuth 제공자 조회
        const linkedOAuthAccounts = await this.oauthService.findByAnd({ userId: existingUser.id });
        const linkedProviders = linkedOAuthAccounts.map((acc) => acc.provider);

        this.logger.warn(`${this.authenticateOAuthUser.name} - OAuth 이메일 중복 감지`, {
          email: userInfo.email,
          attemptedProvider: provider,
          existingUserId: existingUser.id,
          hasPassword: !!existingUser.password,
          linkedProviders,
        });

        // ✅ 3. 에러 발생
        throw OAuthException.emailAlreadyInUse({
          email: userInfo.email,
          provider,
          hasPassword: !!existingUser.password,
          hasOAuthProviders: linkedProviders,
        });
      }

      // ✅ 4. 이메일 중복 없으면 신규 가입 진행
      const userAttrs = {
        email: userInfo.email,
        name: userInfo.name,
        nickname: 'nickname' in userInfo ? userInfo.nickname : userInfo.name,
        profileImageUrl: 'profileImage' in userInfo ? userInfo.profileImage : userInfo.picture,
        isEmailVerified: true,
      };

      // 새 사용자 생성
      user = await this.userService.createUser(userAttrs, transactionManager);

      // OAuth 계정 생성
      const tokenAttributes = this.oauthTokenService.buildTokenAttributes(tokenData);
      const oauthAccountAttrs = {
        providerId: userInfo.id,
        provider,
        userId: user.id,
        ...tokenAttributes,
      };

      await this.oauthService.createOAuthAccount(oauthAccountAttrs, transactionManager);

      this.logger.log(
        `${this.authenticateOAuthUser.name} - 신규 회원가입 완료. userId: ${user.id}, email: ${user.email}`
      );
    }

    this.logger.log(`${this.authenticateOAuthUser.name} - 성공적으로 종료되었습니다.`);

    return user;
  }
}
