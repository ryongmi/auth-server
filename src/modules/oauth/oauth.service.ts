import { randomBytes } from 'crypto';

import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EntityManager, FindOptionsWhere, In, UpdateResult } from 'typeorm';
import { Response } from 'express';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import type {
  OAuthAccountFilter,
  NaverOAuthCallbackQuery,
  NaverUserProfileResponse,
  GoogleUserProfileResponse,
  GoogleTokenResponse,
  NaverTokenResponse,
} from '@krgeobuk/oauth/interfaces';
import { OAuthException } from '@krgeobuk/oauth/exception';
import { OauthStateMode } from '@krgeobuk/oauth/enum';
import { UserException } from '@krgeobuk/user/exception';
import { EmailService } from '@krgeobuk/email';

import { JwtTokenService } from '@common/jwt/index.js';
import { DefaultConfig } from '@common/interfaces/config.interfaces.js';
import { UserEntity, UserService } from '@modules/user/index.js';
import { RedisService } from '@database/redis/redis.service.js';
import { AccountMergeService } from '@modules/account-merge/account-merge.service.js';

import { OAuthAccountEntity } from './entities/oauth-account.entity.js';
import { GoogleOAuthService } from './google.service.js';
import { NaverOAuthService } from './naver.service.js';
import { OAuthRepository } from './oauth.repository.js';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly jwtService: JwtTokenService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly naverOAuthService: NaverOAuthService,
    private readonly oauthRepo: OAuthRepository,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => AccountMergeService))
    private readonly accountMergeService: AccountMergeService
  ) {}

  // state 값 생성
  async generateState(type: OAuthAccountProviderType, stateData?: string): Promise<string> {
    this.logger.log(`${this.generateState.name} - 시작 되었습니다.`);

    // const state = randomBytes(16).toString('hex');
    const state = Math.random().toString(36).substring(2, 15); // 랜덤 문자열 생성

    const data = stateData || 'pending';

    if (type === OAuthAccountProviderType.NAVER) {
      await this.redisService.setNaverState(state, data, 300);
    } else if (type === OAuthAccountProviderType.GOOGLE) {
      await this.redisService.setGoogleState(state, data, 300);
    } else {
      throw new Error(`Unsupported OAuth provider: ${type}`);
    }

    this.logger.log(`${this.generateState.name} - 성공적으로 종료되었습니다.`);

    return state; // 생성된 state 반환
  }

  // state 값 검증
  async validateState(state: string, type: OAuthAccountProviderType): Promise<boolean> {
    this.logger.log(`${this.validateState.name} - 시작 되었습니다.`);

    let value: string | null;

    if (type === OAuthAccountProviderType.NAVER) {
      value = await this.redisService.getNaverState(state);
    } else if (type === OAuthAccountProviderType.GOOGLE) {
      value = await this.redisService.getGoogleState(state);
    } else {
      throw new Error(`Unsupported OAuth provider: ${type}`);
    }

    this.logger.log(`${this.validateState.name} - 성공적으로 종료되었습니다.`);

    return value !== null; // state가 존재하면 유효한 state
  }

  // state에서 데이터 파싱 (mode, userId, returnUrl 등)
  async getStateData(
    state: string,
    type: OAuthAccountProviderType
  ): Promise<{
    mode?: string;
    userId?: string;
    redirectSession?: string;
  } | null> {
    this.logger.log(`${this.getStateData.name} - 시작 되었습니다.`);

    let value: string | null;

    if (type === OAuthAccountProviderType.NAVER) {
      value = await this.redisService.getNaverState(state);
    } else if (type === OAuthAccountProviderType.GOOGLE) {
      value = await this.redisService.getGoogleState(state);
    } else {
      throw new Error(`Unsupported OAuth provider: ${type}`);
    }

    if (!value) return null;

    // JSON 형식인 경우 파싱
    try {
      const parsed = JSON.parse(value);
      this.logger.log(`${this.getStateData.name} - 성공적으로 종료되었습니다.`);
      return parsed;
    } catch {
      // JSON이 아닌 경우 null 반환
      this.logger.log(`${this.getStateData.name} - 성공적으로 종료되었습니다.`);
      return null;
    }
  }

  // 인증 후 state 삭제
  async deleteState(state: string, type: OAuthAccountProviderType): Promise<void> {
    this.logger.log(`${this.deleteState.name} - 시작 되었습니다.`);

    if (type === OAuthAccountProviderType.NAVER) {
      await this.redisService.deleteNaverState(state);
    } else if (type === OAuthAccountProviderType.GOOGLE) {
      await this.redisService.deleteGoogleState(state);
    } else {
      throw new Error(`Unsupported OAuth provider: ${type}`);
    }

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

    // state에서 mode 파싱
    const stateData = await this.getStateData(query.state, providerType);

    if (!stateData?.mode) {
      throw OAuthException.invalidState();
    }

    // this.deleteState(query.state, providerType);

    // 계정 연동 모드인 경우
    if (stateData.mode === OauthStateMode.LINK) {
      await this.linkOAuthAccount(
        stateData.userId!,
        providerType,
        naverUserInfo,
        tokenData,
        transactionManager
      );

      // 연동 완료 후 계정 설정 페이지로 리다이렉트
      const authClientUrl = this.configService.get('authClientUrl')!;

      return `${authClientUrl}/settings/accounts?linked=true&provider=${providerType}`;
    }

    // 일반 로그인 모드
    if (stateData.mode === OauthStateMode.LOGIN) {
      const user = await this.oauthLogin(
        naverUserInfo,
        providerType,
        tokenData,
        transactionManager
      );

      // tokenData - 현재 사용 고려 x / 우선 토큰에 넣기만함
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
          this.logger.log(`${this.loginNaver.name} - 성공적으로 종료되었습니다.`);
          return sessionData.redirectUri;
        }
      }

      const portalClientUrl =
        this.configService.get<DefaultConfig['portalClientUrl']>('portalClientUrl')!;

      this.logger.log(`${this.loginNaver.name} - 성공적으로 종료되었습니다.`);

      return portalClientUrl;
    }

    // 잘못된 mode
    throw OAuthException.invalidState();
  }

  async loginGoogle(
    res: Response,
    transactionManager: EntityManager,
    query: NaverOAuthCallbackQuery
  ): Promise<string> {
    this.logger.log(`${this.loginGoogle.name} - 시작 되었습니다.`);

    const { tokenData, googleUserInfo } = await this.googleOAuthService.getGoogleUserInfo(query);
    const providerType = OAuthAccountProviderType.GOOGLE;

    // state에서 mode 파싱
    const stateData = await this.getStateData(query.state, providerType);

    if (!stateData?.mode) {
      throw OAuthException.invalidState();
    }

    // this.deleteState(query.state, providerType);

    // 계정 연동 모드인 경우
    if (stateData.mode === OauthStateMode.LINK) {
      await this.linkOAuthAccount(
        stateData.userId!,
        providerType,
        googleUserInfo,
        tokenData,
        transactionManager
      );

      // 연동 완료 후 계정 설정 페이지로 리다이렉트
      const authClientUrl =
        this.configService.get<DefaultConfig['authClientUrl']>('authClientUrl')!;

      return `${authClientUrl}/settings/accounts?linked=true&provider=${providerType}`;
    }

    // 일반 로그인 모드
    if (stateData.mode === OauthStateMode.LOGIN) {
      const user = await this.oauthLogin(
        googleUserInfo,
        providerType,
        tokenData,
        transactionManager
      );

      // tokenData - 현재 사용 고려 x / 우선 토큰에 넣기만함
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
          this.logger.log(`${this.loginGoogle.name} - 성공적으로 종료되었습니다.`);
          return sessionData.redirectUri;
        }
      }

      const portalClientUrl =
        this.configService.get<DefaultConfig['portalClientUrl']>('portalClientUrl')!;

      this.logger.log(`${this.loginGoogle.name} - 성공적으로 종료되었습니다.`);

      return portalClientUrl;
    }

    // 잘못된 mode
    throw OAuthException.invalidState();
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

  /**
   * 사용자가 연동한 OAuth 계정 목록 조회
   */
  async getLinkedAccounts(userId: string): Promise<OAuthAccountEntity[]> {
    this.logger.log(`${this.getLinkedAccounts.name} - userId: ${userId}`);
    return this.findByAnd({ userId });
  }

  /**
   * OAuth 계정 연동 해제
   * 최소 1개의 로그인 방식은 유지되어야 함
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
    const existingOAuth = await this.findByAnd({ providerId: userInfo.id, provider });

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
    // const alreadyLinked = await this.findByAnd({ userId, provider });

    // if (alreadyLinked.length > 0) {
    //   throw OAuthException.providerAlreadyLinked(provider);
    // }
    if (existingOAuth.length > 0 && existingOAuth[0]?.userId === userId) {
      throw OAuthException.providerAlreadyLinked(provider);
    }

    // 3. OAuth 계정 연동
    const oauthAccountAttrs: Partial<OAuthAccountEntity> = {
      userId,
      provider,
      providerId: userInfo.id,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken ?? null,
      tokenExpiresAt: tokenData.expiresIn
        ? new Date(Date.now() + tokenData.expiresIn * 1000)
        : null,
      scopes: 'scope' in tokenData ? tokenData.scope : null,
    };

    const linkedAccount = await this.createOAuthAccount(oauthAccountAttrs, transactionManager);

    this.logger.log(`${this.linkOAuthAccount.name} - 성공적으로 종료되었습니다.`);

    return linkedAccount;
  }

  private async oauthLogin(
    userInfo: NaverUserProfileResponse | GoogleUserProfileResponse,
    provider: OAuthAccountProviderType,
    tokenData: NaverTokenResponse | GoogleTokenResponse,
    transactionManager: EntityManager
  ): Promise<UserEntity> {
    this.logger.log(`${this.oauthLogin.name} - 시작 되었습니다.`);

    // ✅ OAuth ID 우선 조회 (가장 신뢰할 수 있는 식별자)
    const oauth = (await this.findByAnd({ provider, providerId: userInfo.id }))[0];

    let user: UserEntity | null;

    if (oauth) {
      // 🔹 기존 OAuth 계정 발견 - userId로 사용자 조회
      this.logger.log(
        `${this.oauthLogin.name} - 기존 OAuth 계정 발견. provider: ${provider}, providerId: ${userInfo.id}`
      );

      user = await this.userService.findById(oauth.userId);

      if (!user) {
        // OAuth는 존재하는데 User가 없는 경우 (데이터 정합성 오류)
        this.logger.error(
          `${this.oauthLogin.name} - OAuth 계정은 존재하나 User를 찾을 수 없습니다. userId: ${oauth.userId}`
        );
        throw UserException.userNotFound();
      }

      // OAuth 토큰 정보 업데이트
      const oauthAccountAttrs = {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken ?? null,
        tokenExpiresAt: tokenData.expiresIn
          ? new Date(Date.now() + tokenData.expiresIn * 1000)
          : null,
        scopes: 'scope' in tokenData ? tokenData.scope : null,
      };

      Object.assign(oauth, oauthAccountAttrs);
      await this.updateOAuthAccount(oauth, transactionManager);

      this.logger.log(`${this.oauthLogin.name} - OAuth 토큰 업데이트 완료. userId: ${user.id}`);
    } else {
      // 🔹 새로운 OAuth 계정 - 이메일 중복 체크 필요
      this.logger.log(
        `${this.oauthLogin.name} - 신규 OAuth 계정. provider: ${provider}, providerId: ${userInfo.id}`
      );

      // ✅ 1. 이메일로 기존 사용자 조회
      const existingUser = await this.userService.findByEmail(userInfo.email);

      if (existingUser) {
        // ✅ 2. 기존 사용자가 있으면 연동된 OAuth 제공자 조회
        const linkedOAuthAccounts = await this.findByAnd({ userId: existingUser.id });
        const linkedProviders = linkedOAuthAccounts.map((acc) => acc.provider);

        this.logger.warn(`${this.oauthLogin.name} - OAuth 이메일 중복 감지`, {
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
      const oauthAccountAttrs = {
        providerId: userInfo.id,
        provider,
        userId: user.id,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken ?? null,
        tokenExpiresAt: tokenData.expiresIn
          ? new Date(Date.now() + tokenData.expiresIn * 1000)
          : null,
        scopes: 'scope' in tokenData ? tokenData.scope : null,
      };

      await this.createOAuthAccount(oauthAccountAttrs, transactionManager);

      this.logger.log(
        `${this.oauthLogin.name} - 신규 회원가입 완료. userId: ${user.id}, email: ${user.email}`
      );
    }

    this.logger.log(`${this.oauthLogin.name} - 성공적으로 종료되었습니다.`);

    return user;
  }

  /**
   * OAuth 계정 이전
   * sourceUser의 OAuth 계정을 targetUser로 이전
   *
   * @param sourceUserId - 원본 사용자 ID
   * @param targetUserId - 대상 사용자 ID
   * @param provider - OAuth 제공자
   * @param providerId - OAuth 제공자의 사용자 ID
   */
  async transferOAuthAccount(
    sourceUserId: string,
    targetUserId: string,
    provider: OAuthAccountProviderType,
    providerId: string
  ): Promise<void> {
    this.logger.log('Transferring OAuth account', {
      from: sourceUserId,
      to: targetUserId,
      provider,
      providerId,
    });

    const result = await this.oauthRepo.update(
      { userId: sourceUserId, provider, providerId },
      { userId: targetUserId }
    );

    if (result.affected === 0) {
      throw new Error('OAuth account not found for transfer');
    }

    this.logger.log('OAuth account transferred successfully');
  }

  /**
   * 병합 확인 이메일 발송
   * User B에게 병합 확인 이메일 발송
   *
   * @param mergeRequest - 병합 요청 엔티티
   */
  async sendMergeConfirmationEmail(mergeRequest: any): Promise<void> {
    this.logger.log('Sending merge confirmation email', {
      requestId: mergeRequest.id,
      sourceUserId: mergeRequest.sourceUserId,
    });

    // User A와 User B 정보 조회
    const [targetUser, sourceUser] = await Promise.all([
      this.userService.findById(mergeRequest.targetUserId),
      this.userService.findById(mergeRequest.sourceUserId),
    ]);

    if (!targetUser || !sourceUser) {
      throw new Error('User not found for merge confirmation email');
    }

    // 확인 토큰 생성 (24시간 유효) - 랜덤 바이트 기반
    const confirmToken = randomBytes(32).toString('hex');

    // Redis에 토큰 저장 (24시간 TTL)
    await this.redisService.setMergeToken(mergeRequest.id, confirmToken, 86400);

    // 확인 URL 생성
    const authClientUrl = this.configService.get<DefaultConfig['authClientUrl']>('authClientUrl')!;
    const confirmUrl = `${authClientUrl}/oauth/merge/confirm?token=${confirmToken}`;

    // 만료 시간 계산 (24시간 후)
    const expiresAt = new Date(Date.now() + 86400000).toLocaleString('ko-KR');

    // 이메일 발송
    await this.emailService.sendAccountMergeEmail({
      to: sourceUser.email,
      name: sourceUser.name || sourceUser.email,
      targetUserEmail: targetUser.email,
      provider: mergeRequest.provider,
      providerId: mergeRequest.providerId,
      confirmUrl,
      expiresAt,
    });

    this.logger.log('Merge confirmation email sent', {
      to: sourceUser.email,
      requestId: mergeRequest.id,
    });
  }

  /**
   * OAuth 계정 복원
   * 보상 트랜잭션에서 사용 - 병합 실패 시 OAuth 계정 복원
   *
   * @param account - 복원할 OAuth 계정 정보
   */
  async restore(account: Partial<OAuthAccountEntity>): Promise<void> {
    this.logger.log('Restoring OAuth account', {
      userId: account.userId,
      provider: account.provider,
    });

    await this.oauthRepo.save(account);

    this.logger.log('OAuth account restored');
  }
}
