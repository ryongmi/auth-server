import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, FindOptionsWhere, In, UpdateResult } from 'typeorm';
import { Response } from 'express';

import { OAuthAccountProviderType } from '@krgeobuk/oauth/enum';
import type {
  OAuthAccountFilter,
  NaverOAuthCallbackQuery,
  NaverUserProfileResponse,
  GoogleUserProfileResponse,
} from '@krgeobuk/oauth/interfaces';
import type { AuthLoginResponse } from '@krgeobuk/auth/interfaces';

import { RedisService } from '@database';
import { JwtConfig } from '@common/interfaces/index.js';
import { User, UserService } from '@modules/user/index.js';
import { AuthService } from '@modules/auth/index.js';

import { OAuthAccount } from './entities/oauth-account.entity.js';
import { GoogleOAuthService } from './google.service.js';
import { NaverOAuthService } from './naver.service.js';
import { OAuthRepository } from './oauth.repositoty.js';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    // private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly naverOAuthService: NaverOAuthService,
    private readonly oauthRepo: OAuthRepository
  ) {}

  // state 값 생성
  async generateState(type: OAuthAccountProviderType): Promise<string> {
    this.logger.log(`${this.generateState.name} - 시작 되었습니다.`);

    // const state = randomBytes(16).toString('hex');
    const state = Math.random().toString(36).substring(2, 15); // 랜덤 문자열 생성
    const stateStore = this.configService.get<JwtConfig['naverStateStore' | 'googleStateStore']>(
      `jwt.${type}StateStore`
    );

    await this.redisService.setExValue(`${stateStore}${state}`, 300, 'pending'); // Redis에 상태값 저장 (5분 동안 유지)

    this.logger.log(`${this.generateState.name} - 성공적으로 종료되었습니다.`);

    return state; // 생성된 state 반환
  }

  // state 값 검증
  async validateState(state: string, type: OAuthAccountProviderType): Promise<boolean> {
    this.logger.log(`${this.validateState.name} - 시작 되었습니다.`);

    const stateStore = this.configService.get<JwtConfig['naverStateStore' | 'googleStateStore']>(
      `jwt.${type}StateStore`
    );
    const value = await this.redisService.getValue(`${stateStore}${state}`);

    this.logger.log(`${this.validateState.name} - 성공적으로 종료되었습니다.`);

    return value === 'pending'; // 'pending' 상태이면 유효한 state
  }

  // 인증 후 state 삭제
  async deleteState(state: string, type: OAuthAccountProviderType): Promise<void> {
    this.logger.log(`${this.deleteState.name} - 시작 되었습니다.`);

    const stateStore = this.configService.get<JwtConfig['naverStateStore' | 'googleStateStore']>(
      `jwt.${type}StateStore`
    );

    await this.redisService.deleteValue(`${stateStore}${state}`); // 인증 완료 후 state 삭제

    this.logger.log(`${this.deleteState.name} - 성공적으로 종료되었습니다.`);
  }

  async findById(id: string): Promise<OAuthAccount | null> {
    return this.oauthRepo.findOneById(id);
  }

  // async findByUserId(userId: string): Promise<OAuthAccount[]> {
  //   return this.oauthRepo.find({ where: { userId } });
  // }

  // async findProvider(provider: OAuthAccountProviderType): Promise<OAuthAccount[]> {
  //   return this.oauthRepo.find({ where: { provider } });
  // }

  async findUserIds(userIds: string[]): Promise<OAuthAccount[]> {
    return this.oauthRepo.find({ where: { userId: In(userIds) } });
  }

  async findByAnd(filter: OAuthAccountFilter = {}): Promise<OAuthAccount[]> {
    const where: FindOptionsWhere<OAuthAccount> = {};

    if (filter.userId) where.userId = filter.userId;
    if (filter.provider) where.provider = filter.provider;

    // ✅ 필터 없으면 전체 조회
    if (Object.keys(where).length === 0) {
      return this.oauthRepo.find(); // 조건 없이 전체 조회
    }

    return this.oauthRepo.find({ where });
  }

  async findByOr(filter: OAuthAccountFilter = {}): Promise<OAuthAccount[]> {
    const { userId, provider } = filter;

    const where: FindOptionsWhere<OAuthAccount>[] = [];

    if (userId) where.push({ userId });
    if (provider) where.push({ provider });

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
  ): Promise<AuthLoginResponse> {
    this.logger.log(`${this.loginNaver.name} - 시작 되었습니다.`);

    const { tokenData, naverUserInfo } = await this.naverOAuthService.getNaverUserInfo(query);

    const user = await this.oauthLogin(
      naverUserInfo,
      OAuthAccountProviderType.NAVER,
      transactionManager
    );

    // tokenData - 현재 사용 고려 x / 우선 토큰에 넣기만함
    // const payload = {
    //   id: user.id,
    //   tokenData,
    //   // provider: ProviderType.NAVER,
    // };

    const { accessToken } = await this.authService.issueTokens(res, user, tokenData);

    this.logger.log(`${this.loginNaver.name} - 성공적으로 종료되었습니다.`);

    return { user, accessToken };
  }

  async loginGoogle(
    res: Response,
    transactionManager: EntityManager,
    query: NaverOAuthCallbackQuery
  ): Promise<AuthLoginResponse> {
    this.logger.log(`${this.loginGoogle.name} - 시작 되었습니다.`);

    const { tokenData, googleUserInfo } = await this.googleOAuthService.getGoogleUserInfo(query);

    const user = await this.oauthLogin(
      googleUserInfo,
      OAuthAccountProviderType.GOOGLE,
      transactionManager
    );

    // tokenData - 현재 사용 고려 x / 우선 토큰에 넣기만함
    // const payload = {
    //   id: user.id,
    //   tokenData,
    //   // provider: ProviderType.GOOGLE,
    // };

    const { accessToken } = await this.authService.issueTokens(res, user, tokenData);

    this.logger.log(`${this.loginGoogle.name} - 성공적으로 종료되었습니다.`);

    return { user, accessToken };
  }

  async createOAuthAccount(
    attrs: Partial<OAuthAccount>,
    transactionManager?: EntityManager
  ): Promise<OAuthAccount> {
    const oauthAccountEntity = new OAuthAccount();

    Object.assign(oauthAccountEntity, attrs);

    return this.oauthRepo.saveEntity(oauthAccountEntity, transactionManager);
  }

  async updateOAuthAccount(
    oauthAccountEntity: OAuthAccount,
    transactionManager?: EntityManager
  ): Promise<UpdateResult> {
    return this.oauthRepo.updateEntity(oauthAccountEntity, transactionManager);
  }

  private async oauthLogin(
    userInfo: NaverUserProfileResponse | GoogleUserProfileResponse,
    ProviderType: OAuthAccountProviderType,
    transactionManager: EntityManager
  ): Promise<User> {
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

        const oauth = await this.oauthRepo.findOAuthAccountByUserId(user.id);
        if (!oauth) {
          // 에러 없을수가 없음
          throw Error();
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
}
