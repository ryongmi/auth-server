import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { Response } from 'express';

import { ProviderType } from '@krgeobuk/oauth/enum';
import type { NaverOAuthCallbackQuery } from '@krgeobuk/oauth/interfaces';
import type { LoginResponse } from '@krgeobuk/auth/interfaces';
import type { LoggedInUser } from '@krgeobuk/user/interfaces';

import { RedisService } from '@database';
import { UserService } from '@modules/user/index.js';
import { JwtTokenService } from '@common/jwt/index.js';

import { OAuthAccount } from './entities/oauth-account.entity.js';
import { GoogleOAuthService } from './google.service.js';
import { NaverOAuthService } from './naver.service.js';
import { OAuthRepository } from './oauth.repositoty.js';

@Injectable()
export class OAuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtTokenService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly naverOAuthService: NaverOAuthService,
    private readonly oauthRepo: OAuthRepository
  ) {}

  // state 값 생성
  async generateState(type: ProviderType): Promise<string> {
    // const state = randomBytes(16).toString('hex');
    const state = Math.random().toString(36).substring(2, 15); // 랜덤 문자열 생성
    const stateStore = this.configService.get<string>(`jwt.${type}StateStore`);

    await this.redisService.setExValue(`${stateStore}${state}`, 300, 'pending'); // Redis에 상태값 저장 (5분 동안 유지)

    return state; // 생성된 state 반환
  }

  // state 값 검증
  async validateState(state: string, type: ProviderType): Promise<boolean> {
    const stateStore = this.configService.get<string>(`jwt.${type}StateStore`);

    const value = await this.redisService.getValue(`${stateStore}${state}`);
    return value === 'pending'; // 'pending' 상태이면 유효한 state
  }

  // 인증 후 state 삭제
  async deleteState(state: string, type: ProviderType): Promise<void> {
    const stateStore = this.configService.get<string>(`jwt.${type}StateStore`);

    await this.redisService.deleteValue(`${stateStore}${state}`); // 인증 완료 후 state 삭제
  }

  async loginNaver(
    res: Response,
    transactionManager: EntityManager,
    query: NaverOAuthCallbackQuery
  ): Promise<LoginResponse<LoggedInUser>> {
    let oauth;

    const { tokenData, naverUserInfo } = await this.naverOAuthService.getNaverUserInfo(query);

    let user = await this.userService.findUserByEmail(naverUserInfo.email);

    const oauthAccountAttrs = {
      providerId: naverUserInfo.id,
      provider: ProviderType.NAVER,
    };

    if (user) {
      // 이메일이 이미 존재하는 경우 계정 병합
      if (!user.isIntegrated) {
        // 처음 병합할 경우 필요한 정보 업데이트
        user.name ||= naverUserInfo.name;
        user.nickname ||= naverUserInfo.nickname;
        user.profileImage ||= naverUserInfo.profileImage;
        user.isIntegrated = true;

        oauth = await this.oauthRepo.findOAuthAccountByUserId(user.id);
        if (!oauth) {
          // 에러 없을수가 없음
          throw Error();
        }

        Object.assign(oauth, oauthAccountAttrs);

        oauth = await this.updateOAuthAccount(oauth, transactionManager);
      }

      // 마지막 접속일 업데이트
      // user.lastLogin = new Date();

      user = await this.userService.updateUser(user, transactionManager);
    } else {
      const userAttrs = {
        email: naverUserInfo.email,
        name: naverUserInfo.name,
        nickname: naverUserInfo.nickname,
        profileImage: naverUserInfo.profileImage,
        isIntegrated: true,
      };

      // 이메일이 존재하지 않는 경우 새 사용자 생성
      user = await this.userService.createUser(userAttrs, transactionManager);

      oauth = await this.createOAuthAccount(oauthAccountAttrs, transactionManager);
    }

    // tokenData - 현재 사용 고려 x / 우선 토큰에 넣기만함
    const payload = {
      id: user.id,
      tokenData,
    };

    // const accessToken = await this.jwtService.signAccessToken(payload);
    // const refreshToken = await this.jwtService.signRefreshToken(payload);
    // 공통적으로 사용하는 곳이 많아 한번에 에세스, 리프레쉬 토큰 생성 메서드 추가가
    const { accessToken, refreshToken } =
      await this.jwtService.signAccessTokenAndRefreshToken(payload);

    this.jwtService.setRefreshTokenToCookie(res, refreshToken);

    return { user, accessToken };
  }

  async loginGoogle(
    res: Response,
    transactionManager: EntityManager,
    query: NaverOAuthCallbackQuery
  ): Promise<LoginResponse<LoggedInUser>> {
    let oauth;

    const { tokenData, googleUserInfo } = await this.googleOAuthService.getGoogleUserInfo(query);

    let user = await this.userService.findUserByEmail(googleUserInfo.email);

    const oauthAccountAttrs = {
      providerId: googleUserInfo.id,
      provider: ProviderType.GOOGLE,
    };

    if (user) {
      // 이메일이 이미 존재하는 경우 계정 병합
      if (!user.isIntegrated) {
        // 처음 병합할 경우 필요한 정보 업데이트
        user.name ||= googleUserInfo.name;
        user.nickname ||= googleUserInfo.name;
        user.profileImage ||= googleUserInfo.picture;
        user.isIntegrated = true;

        oauth = await this.oauthRepo.findOAuthAccountByUserId(user.id);
        if (!oauth) {
          // 에러 없을수가 없음
          throw Error();
        }

        Object.assign(oauth, oauthAccountAttrs);

        oauth = await this.updateOAuthAccount(oauth, transactionManager);
      }

      // 마지막 접속일 업데이트
      // user.lastLogin = new Date();

      user = await this.userService.updateUser(user, transactionManager);
    } else {
      const userAttrs = {
        // oauthId: googleUserInfo.id,
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        nickname: googleUserInfo.name,
        profileImage: googleUserInfo.picture,
        isIntegrated: true,
      };

      // 이메일이 존재하지 않는 경우 새 사용자 생성
      user = await this.userService.createUser(userAttrs, transactionManager);

      oauth = await this.createOAuthAccount(oauthAccountAttrs, transactionManager);
    }

    // tokenData - 현재 사용 고려 x / 우선 토큰에 넣기만함
    const payload = {
      id: user.id,
      tokenData,
    };

    // const accessToken = await this.jwtService.signAccessToken(payload);
    // const refreshToken = await this.jwtService.signRefreshToken(payload);
    const { accessToken, refreshToken } =
      await this.jwtService.signAccessTokenAndRefreshToken(payload);

    this.jwtService.setRefreshTokenToCookie(res, refreshToken);

    return { user, accessToken };
    // return { user, tokenData, accessToken };
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
  ): Promise<OAuthAccount> {
    return this.oauthRepo.saveEntity(oauthAccountEntity, transactionManager);
  }
}
