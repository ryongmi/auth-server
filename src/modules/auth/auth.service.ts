import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { scrypt as _scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { User, OAuthAccount } from '../user/entities';
import { EntityManager } from 'typeorm';
import { GoogleOAuthService } from './google-oauth.service';
import { NaverOAuthService } from './naver-oauth.service';
import { UserException } from 'src/exception';
import { RedisService } from 'src/database/redis/redis.service';
import { JwtTokenService } from './jwt/jwt-token.service';
import { UserType } from '../../common/enum';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

const scrypt = promisify(_scrypt);

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly naverOAuthService: NaverOAuthService,
    private readonly jwtService: JwtTokenService,
    private config: ConfigService,
  ) {}

  // state 값 생성
  async generateState(): Promise<string> {
    // const state = randomBytes(16).toString('hex');
    const state = Math.random().toString(36).substring(2, 15); // 랜덤 문자열 생성
    const naverStateStore = this.config.get<string>('jwt.naverStateStore');

    await this.redisService.setExValue(
      `${naverStateStore}${state}`,
      300,
      'pending',
    ); // Redis에 상태값 저장 (5분 동안 유지)

    return state; // 생성된 state 반환
  }

  // state 값 검증
  async validateState(state: string): Promise<boolean> {
    const naverStateStore = this.config.get<string>('jwt.naverStateStore');

    const value = await this.redisService.getValue(
      `${naverStateStore}${state}`,
    );
    return value === 'pending'; // 'pending' 상태이면 유효한 state
  }

  // 인증 후 state 삭제
  async deleteState(state: string): Promise<void> {
    const naverStateStore = this.config.get<string>('jwt.naverStateStore');

    await this.redisService.deleteValue(`${naverStateStore}${state}`); // 인증 완료 후 state 삭제
  }

  async loginNaver(
    res: Response,
    transactionManager: EntityManager,
    code: string,
    state: string,
  ) {
    const { tokenData, naverUserInfo } =
      await this.naverOAuthService.getNaverUserInfo(code, state);

    let user = await this.userService.findByEmail(naverUserInfo.email);
    let oauthAccount = new OAuthAccount();
    oauthAccount.providerId = naverUserInfo.id;
    oauthAccount.provider = UserType.NAVER;

    if (user) {
      // 이메일이 이미 존재하는 경우 계정 병합
      if (!user.oauthAccount?.providerId) {
        // 처음 병합할 경우 필요한 정보 업데이트
        user.name ||= naverUserInfo.name;
        user.nickname ||= naverUserInfo.nickname;
        user.profileImage ||= naverUserInfo.profile_image;
        user.oauthAccount = { ...oauthAccount, provider: UserType.INTEGRATE };
      }

      // 마지막 접속일 업데이트
      // user.lastLogin = new Date();

      user = await this.userService.updateUser(user);
    } else {
      // 이메일이 존재하지 않는 경우 새 사용자 생성
      user = await this.userService.createUser(transactionManager, {
        // oauthId: googleUserInfo.id,
        email: naverUserInfo.email,
        name: naverUserInfo.name,
        nickname: naverUserInfo.nickname,
        profileImage: naverUserInfo.profile_image,
        oauthAccount,
      });
    }

    // tokenData - 현재 사용 고려 x / 우선 토큰에 넣기만함
    const payload = {
      id: user.id,
      tokenData,
    };

    const accessToken = await this.jwtService.signAccessToken(payload);
    const refreshToken = await this.jwtService.signRefreshToken(payload);

    this.jwtService.setRefreshTokenToCookie(res, refreshToken);

    return { user, accessToken };
  }

  async loginGoogle(
    res: Response,
    transactionManager: EntityManager,
    code: string,
  ) {
    const { tokenData, googleUserInfo } =
      await this.googleOAuthService.getGoogleUserInfo(code);

    let user = await this.userService.findByEmail(googleUserInfo.email);
    let oauthAccount = new OAuthAccount();
    oauthAccount.providerId = googleUserInfo.id;
    oauthAccount.provider = UserType.GOOGLE;

    if (user) {
      // 이메일이 이미 존재하는 경우 계정 병합
      if (!user.oauthAccount?.providerId) {
        // 처음 병합할 경우 필요한 정보 업데이트
        user.name ||= googleUserInfo.name;
        user.nickname ||= googleUserInfo.name;
        user.profileImage ||= googleUserInfo.picture;
        user.oauthAccount = { ...oauthAccount, provider: UserType.INTEGRATE };
      }

      // 마지막 접속일 업데이트
      // user.lastLogin = new Date();

      user = await this.userService.updateUser(user);
    } else {
      // 이메일이 존재하지 않는 경우 새 사용자 생성
      user = await this.userService.createUser(transactionManager, {
        // oauthId: googleUserInfo.id,
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        nickname: googleUserInfo.name,
        profileImage: googleUserInfo.picture,
        oauthAccount,
      });
    }

    // tokenData - 현재 사용 고려 x / 우선 토큰에 넣기만함
    const payload = {
      id: user.id,
      tokenData,
    };

    const accessToken = await this.jwtService.signAccessToken(payload);
    const refreshToken = await this.jwtService.signRefreshToken(payload);

    this.jwtService.setRefreshTokenToCookie(res, refreshToken);

    return { user, accessToken };
    // return { user, tokenData, accessToken };
  }

  async logout(req: Request, res: Response) {
    const refreshToken = this.jwtService.getRefreshTokenToCookie(req);

    const blackListStore = this.config.get<string>('jwt.blackListStore');
    const refreshMaxAge = this.config.get<number>('jwt.refreshMaxAge');

    await this.redisService.setExValue(
      `${blackListStore}${refreshToken}`,
      refreshMaxAge,
      '1',
    ); // Redis에 블랙리스트 지정

    this.jwtService.clearRefreshTokenCookie(res);
  }

  async login(userId: string, password: string) {
    const user = await this.userService.findByUserId(userId);

    if (!user) {
      throw UserException.userNotFound();
    }

    const [salt, storedHash] = user.password.split(';');

    const hash = (await scrypt(password, salt, 32)) as Buffer;
    if (storedHash !== hash.toString('hex')) {
      throw UserException.userInfoNotExist();
    }

    // 마지막 로그인 날짜 기록
    await this.userService.lastLoginUpdate(user.id);

    // return await this.userService.lastLoginUpdate(user);
    return user;
  }

  async signup(transactionManager: EntityManager, attrs: Partial<User>) {
    const users = await this.userService.findByUserIdOREmail(
      attrs.id,
      attrs.email,
    );

    if (users.length !== 0) {
      throw UserException.userUseIdOREmail();
    }

    const salt = randomBytes(8).toString('hex');

    const hash = (await scrypt(attrs.password, salt, 32)) as Buffer;

    const result = salt + ';' + hash.toString('hex');

    // attrs.password = result;

    return await this.userService.createUser(transactionManager, attrs, result);
  }
}
