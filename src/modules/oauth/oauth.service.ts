import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EntityManager, FindOptionsWhere, In, UpdateResult } from 'typeorm';
import { Response } from 'express';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import type {
  OAuthAccountFilter,
  NaverOAuthCallbackQuery,
  NaverUserProfileResponse,
  GoogleUserProfileResponse,
} from '@krgeobuk/oauth/interfaces';
import type { AuthLoginResponse } from '@krgeobuk/auth/interfaces';
import { OAuthException } from '@krgeobuk/oauth/exception';

import { JwtTokenService } from '@common/jwt/index.js';
import { DefaultConfig } from '@common/interfaces/config.interfaces.js';
import { UserEntity, UserService } from '@modules/user/index.js';
import { RedisService } from '@database/index.js';

import { OAuthAccountEntity } from './entities/oauth-account.entity.js';
import { GoogleOAuthService } from './google.service.js';
import { NaverOAuthService } from './naver.service.js';
import { OAuthRepository } from './oauth.repository.js';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    // private readonly dataSource: DataSource,
    private readonly jwtService: JwtTokenService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly naverOAuthService: NaverOAuthService,
    private readonly oauthRepo: OAuthRepository
  ) {}

  // state 값 생성
  async generateState(type: OAuthAccountProviderType, redirectSession?: string): Promise<string> {
    this.logger.log(`${this.generateState.name} - 시작 되었습니다.`);

    // const state = randomBytes(16).toString('hex');
    const state = Math.random().toString(36).substring(2, 15); // 랜덤 문자열 생성

    // redirectSession이 있으면 state를 redirectSession으로 사용
    await this.redisService.setOAuthState(type, state, redirectSession, 300);

    this.logger.log(`${this.generateState.name} - 성공적으로 종료되었습니다.`);

    return state; // 생성된 state 반환
  }

  // state 값 검증
  async validateState(state: string, type: OAuthAccountProviderType): Promise<boolean> {
    this.logger.log(`${this.validateState.name} - 시작 되었습니다.`);

    const value = await this.redisService.getOAuthState(type, state);

    this.logger.log(`${this.validateState.name} - 성공적으로 종료되었습니다.`);

    return value !== null; // state가 존재하면 유효한 state
  }

  // 인증 후 state 삭제
  async deleteState(state: string, type: OAuthAccountProviderType): Promise<void> {
    this.logger.log(`${this.deleteState.name} - 시작 되었습니다.`);

    await this.redisService.deleteOAuthState(type, state); // 인증 완료 후 state 삭제

    this.logger.log(`${this.deleteState.name} - 성공적으로 종료되었습니다.`);
  }

  async findById(id: string): Promise<OAuthAccountEntity | null> {
    return this.oauthRepo.findOneById(id);
  }

  async findByUserIds(userIds: string[]): Promise<OAuthAccountEntity[]> {
    return this.oauthRepo.find({ where: { userId: In(userIds) } });
  }

  async findByAnd(filter: OAuthAccountFilter = {}): Promise<OAuthAccountEntity[]> {
    const where: FindOptionsWhere<OAuthAccountEntity> = {};

    if (filter.userId) where.userId = filter.userId;
    if (filter.provider) where.provider = filter.provider;
    if (filter.providerId) where.providerId = filter.providerId;

    // ✅ 필터 없으면 전체 조회
    if (Object.keys(where).length === 0) {
      return this.oauthRepo.find(); // 조건 없이 전체 조회
    }

    return this.oauthRepo.find({ where });
  }

  async findByOr(filter: OAuthAccountFilter = {}): Promise<OAuthAccountEntity[]> {
    const { userId, provider, providerId } = filter;

    const where: FindOptionsWhere<OAuthAccountEntity>[] = [];

    if (userId) where.push({ userId });
    if (provider) where.push({ provider });
    if (providerId) where.push({ providerId });

    // ✅ 필터 없으면 전체 조회
    if (where.length === 0) {
      return this.oauthRepo.find(); // 조건 없이 전체 조회
    }

    return this.oauthRepo.find({ where });
  }

  async loginNaver(
    res: Response,
    transactionManager: EntityManager,
    query: NaverOAuthCallbackQuery
  ): Promise<string> {
    this.logger.log(`${this.loginNaver.name} - 시작 되었습니다.`);

    const { tokenData, naverUserInfo } = await this.naverOAuthService.getNaverUserInfo(query);
    const providerType = OAuthAccountProviderType.NAVER;

    const user = await this.oauthLogin(naverUserInfo, providerType, transactionManager);

    // tokenData - 현재 사용 고려 x / 우선 토큰에 넣기만함
    const payload = {
      id: user.id,
      tokenData,
      // provider: ProviderType.NAVER,
    };

    const { accessToken, refreshToken } =
      await this.jwtService.signAccessTokenAndRefreshToken(payload);

    this.jwtService.setRefreshTokenToCookie(res, refreshToken);

    // SSO 리다이렉트 처리

    const redirectUrl = await this.handleSSORedirect(
      query.state,
      providerType,
      accessToken,
      refreshToken
    );

    return redirectUrl;
  }

  async loginGoogle(
    res: Response,
    transactionManager: EntityManager,
    query: NaverOAuthCallbackQuery
  ): Promise<string> {
    this.logger.log(`${this.loginGoogle.name} - 시작 되었습니다.`);

    const { tokenData, googleUserInfo } = await this.googleOAuthService.getGoogleUserInfo(query);
    const providerType = OAuthAccountProviderType.GOOGLE;

    const user = await this.oauthLogin(googleUserInfo, providerType, transactionManager);

    // tokenData - 현재 사용 고려 x / 우선 토큰에 넣기만함
    const payload = {
      id: user.id,
      tokenData,
      // provider: ProviderType.GOOGLE,
    };

    const { accessToken, refreshToken } =
      await this.jwtService.signAccessTokenAndRefreshToken(payload);

    this.jwtService.setRefreshTokenToCookie(res, refreshToken);

    // SSO 리다이렉트 처리

    const redirectUrl = await this.handleSSORedirect(
      query.state,
      providerType,
      accessToken,
      refreshToken
    );

    this.logger.log(`${this.loginGoogle.name} - 성공적으로 종료되었습니다.`);

    return redirectUrl;
  }

  async createOAuthAccount(
    attrs: Partial<OAuthAccountEntity>,
    transactionManager?: EntityManager
  ): Promise<OAuthAccountEntity> {
    const oauthAccountEntity = new OAuthAccountEntity();

    Object.assign(oauthAccountEntity, attrs);

    return this.oauthRepo.saveEntity(oauthAccountEntity, transactionManager);
  }

  async updateOAuthAccount(
    oauthAccountEntity: OAuthAccountEntity,
    transactionManager?: EntityManager
  ): Promise<UpdateResult> {
    return this.oauthRepo.updateEntity(oauthAccountEntity, transactionManager);
  }

  private async oauthLogin(
    userInfo: NaverUserProfileResponse | GoogleUserProfileResponse,
    ProviderType: OAuthAccountProviderType,
    transactionManager: EntityManager
  ): Promise<UserEntity> {
    this.logger.log(`${this.oauthLogin.name} - 시작 되었습니다.`);

    let user = (await this.userService.findByAnd({ email: userInfo.email }))[0];

    if (user) {
      // 이메일이 이미 존재하는 경우 계정 병합
      if (!user.isIntegrated) {
        // 처음 병합할 경우 필요한 정보 업데이트
        user.name ||= userInfo.name;
        user.nickname ||= 'nickname' in userInfo ? userInfo.nickname : userInfo.name;
        user.profileImageUrl ||=
          'profileImage' in userInfo ? userInfo.profileImage : userInfo.picture;
        user.isIntegrated = true;

        const oauth = (await this.findByAnd({ userId: user.id }))[0];
        if (!oauth) {
          // 내부 로그: OAuth 계정 누락 에러
          this.logger.error(`[OAUTH_ACCOUNT_NOT_FOUND] 사용자 통합 계정 처리 중 OAuth 계정 누락`, {
            action: 'user_integration',
            userId: user.id,
            userEmail: user.email,
            expectedProvider: 'existing_oauth_account',
          });

          throw OAuthException.userSaveFailed(ProviderType);
        }

        const oauthAccountAttrs = {
          providerId: userInfo.id,
          provider: ProviderType,
          userId: user.id,
        };

        Object.assign(oauth, oauthAccountAttrs);

        await this.updateOAuthAccount(oauth, transactionManager);
      }

      // 마지막 접속일 업데이트
      // user.lastLogin = new Date();

      await this.userService.updateUser(user, transactionManager);
    } else {
      const userAttrs = {
        email: userInfo.email,
        name: userInfo.name,
        nickname: 'nickname' in userInfo ? userInfo.nickname : userInfo.name,
        profileImageUrl: 'profileImage' in userInfo ? userInfo.profileImage : userInfo.picture,
        isIntegrated: true,
      };

      // 이메일이 존재하지 않는 경우 새 사용자 생성
      user = await this.userService.createUser(userAttrs, transactionManager);

      const oauthAccountAttrs = {
        providerId: userInfo.id,
        provider: ProviderType,
        userId: user.id,
      };

      await this.createOAuthAccount(oauthAccountAttrs, transactionManager);
    }

    this.logger.log(`${this.oauthLogin.name} - 성공적으로 종료되었습니다.`);

    return user;
  }

  /**
   * SSO 리다이렉트 처리 (OAuth용)
   */
  private async handleSSORedirect(
    state: string,
    type: OAuthAccountProviderType,
    _accessToken: string,
    _refreshToken: string
  ): Promise<string> {
    const portalClientUrl =
      this.configService.get<DefaultConfig['authClientUrl']>(`authClientUrl`)!;

    // 구글과 네이버 state store에서 redirect session 정보 확인
    let redirectSessionId: string | null = null;

    const stateValue = await this.redisService.getOAuthState(type, state);
    if (stateValue && stateValue !== 'pending') {
      redirectSessionId = stateValue;
    }

    if (!redirectSessionId) return portalClientUrl;

    // redirect session 데이터 확인
    const sessionData = await this.redisService.getRedirectSession(redirectSessionId);

    if (sessionData) {
      const { redirectUri } = sessionData;

      // 세션 정리
      await this.redisService.deleteRedirectSession(redirectSessionId);

      // 원래 서비스로 리다이렉트 (토큰 포함)
      // const callbackUrl = `${redirectUri}?token=${accessToken}&refresh_token=${refreshToken}`;
      const callbackUrl = `${redirectUri}`;
      return callbackUrl;
    }

    return portalClientUrl;
  }
}
