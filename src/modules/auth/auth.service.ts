import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { scrypt as _scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { User } from './entities';
import { EntityManager } from 'typeorm';
import { GoogleOAuthService } from './google-oauth.service';
import { NaverOAuthService } from './naver-oauth.service';
import { UserException } from 'src/exception';
import { RedisService } from 'src/database/redis/redis.service';

const scrypt = promisify(_scrypt);

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly naverOAuthService: NaverOAuthService,
  ) {}

  // state 값 생성
  async generateState(): Promise<string> {
    // const state = randomBytes(16).toString('hex');
    const state = Math.random().toString(36).substring(2, 15); // 랜덤 문자열 생성
    await this.redisService.setExValue(state, 'pending'); // Redis에 상태값 저장 (5분 동안 유지)

    return state; // 생성된 state 반환
  }

  // state 값 검증
  async validateState(state: string): Promise<boolean> {
    const value = await this.redisService.getValue(state);
    return value === 'pending'; // 'pending' 상태이면 유효한 state
  }

  // 인증 후 state 삭제
  async deleteState(state: string): Promise<void> {
    await this.redisService.deleteValue(state); // 인증 완료 후 state 삭제
  }

  async loginNaver(
    transactionManager: EntityManager,
    code: string,
    state: string,
  ) {
    const { tokenData, naverUserInfo } =
      await this.naverOAuthService.getNaverUserInfo(code, state);

    let user = await this.userService.findByEmail(naverUserInfo.email);
    if (user) {
      // 이메일이 이미 존재하는 경우 계정 병합
      if (!user.oauthId) {
        // 처음 병합할 경우 필요한 정보 업데이트
        user.oauthId = naverUserInfo.id;
        user.name ||= naverUserInfo.name;
        user.nickname ||= naverUserInfo.nickname;
        user.profileImage ||= naverUserInfo.profile_image;
      }

      // 마지막 접속일 업데이트
      // user.lastLogin = new Date();

      user = await this.userService.updateUser(user);
    } else {
      // 이메일이 존재하지 않는 경우 새 사용자 생성
      user = await this.userService.createUser(transactionManager, {
        oauthId: naverUserInfo.id,
        name: naverUserInfo.name,
        nickname: naverUserInfo.nickname,
        email: naverUserInfo.email,
        profileImage: naverUserInfo.profile_image,
      });
    }

    return { user, tokenData };
  }

  async loginGoogle(transactionManager: EntityManager, code: string) {
    const { tokenData, googleUserInfo } =
      await this.googleOAuthService.getGoogleUserInfo(code);

    let user = await this.userService.findByEmail(googleUserInfo.email);

    if (user) {
      // 이메일이 이미 존재하는 경우 계정 병합
      if (!user.oauthId) {
        // 처음 병합할 경우 필요한 정보 업데이트
        user.oauthId = googleUserInfo.id;
        user.name ||= googleUserInfo.name;
        user.nickname ||= googleUserInfo.name;
        user.profileImage ||= googleUserInfo.picture;
      }

      // 마지막 접속일 업데이트
      // user.lastLogin = new Date();

      user = await this.userService.updateUser(user);
    } else {
      // 이메일이 존재하지 않는 경우 새 사용자 생성
      user = await this.userService.createUser(transactionManager, {
        oauthId: googleUserInfo.id,
        name: googleUserInfo.name,
        nickname: googleUserInfo.name,
        email: googleUserInfo.email,
        profileImage: googleUserInfo.picture,
      });
    }

    return { user, tokenData };
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

    return await this.userService.createUser(transactionManager, attrs, result);
  }
}
