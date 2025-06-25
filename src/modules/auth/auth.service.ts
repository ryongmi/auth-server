import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Request, Response } from 'express';

import { ProviderType } from '@krgeobuk/oauth/enum';
import type {
  LoginRequest,
  LoginResponse,
  SignupRequest,
  RefreshResponse,
} from '@krgeobuk/auth/interfaces';
import type { LoggedInUser } from '@krgeobuk/user/interfaces';
import { UserException } from '@krgeobuk/user/exception';
import type { JwtPayload } from '@krgeobuk/jwt/interfaces';

import { RedisService } from '@database';
import { hashPassword, isPasswordMatching } from '@common/utils/index.js';
import { JwtTokenService } from '@common/jwt/index.js';

import { UserService } from '@modules/user/index.js';
import { OAuthService } from '@modules/oauth/index.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtTokenService,
    private readonly oauthService: OAuthService
  ) {}

  async logout(req: Request, res: Response): Promise<void> {
    const refreshToken = this.jwtService.getRefreshTokenToCookie(req);

    const blackListStore = this.configService.get<string>('jwt.blackListStore')!;
    const refreshMaxAge = this.configService.get<number>('jwt.refreshMaxAge')!;

    await this.redisService.setExValue(`${blackListStore}${refreshToken}`, refreshMaxAge, 1); // Redis에 블랙리스트 지정

    this.jwtService.clearRefreshTokenCookie(res);
  }

  async login(res: Response, attrs: LoginRequest): Promise<LoginResponse<LoggedInUser>> {
    const { email, password } = attrs;

    const user = await this.userService.findUserByEmail(email);

    if (!user) {
      throw UserException.userNotFound();
    }

    // 생각해보니 이 메서드는 홈페이지 로그인에서만 사용할거라 아래 조건이 필요가없음
    // const userProvider = user.oauthAccount.provider;
    // const isHomepageOrIntegratedUser =
    //   userProvider === ProviderType.HOMEPAGE || userProvider === ProviderType.INTEGRATE;

    // // 홈페이지 또는 통합 아이디만 홈페이지 로그인 가능
    // if (!isHomepageOrIntegratedUser) {
    //   throw UserException.userNotFound();
    // }

    const isMatch = isPasswordMatching(password, user.password ?? '');
    if (!isMatch) {
      throw UserException.invalidLoginInfo();
    }

    // 마지막 로그인 날짜 기록
    // await this.userService.lastLoginUpdate(user.id);

    const payload = {
      id: user.id,
    };

    const { accessToken, refreshToken } =
      await this.jwtService.signAccessTokenAndRefreshToken(payload);

    this.jwtService.setRefreshTokenToCookie(res, refreshToken);

    // return await this.userService.lastLoginUpdate(user);
    return { user, accessToken };
  }

  async signup(res: Response, attrs: SignupRequest): Promise<LoginResponse<LoggedInUser>> {
    const { email, password } = attrs;

    const users = await this.userService.findUserByEmail(email);
    if (users) {
      throw UserException.emailAlreadyInUse();
    }

    const hashedPassword = await hashPassword(password);
    attrs.password = hashedPassword;

    const { user } = await this.dataSource.transaction(async (manager) => {
      const user = await this.userService.createUser(attrs, manager);

      const oauthAccountAttrs = {
        provider: ProviderType.HOMEPAGE,
        userId: user.id,
      };
      const oauthAccount = await this.oauthService.createOAuthAccount(oauthAccountAttrs, manager);

      return { user, oauthAccount };
    });

    const payload = {
      id: user.id,
      // provider: oauthAccount.provider,
    };

    const { accessToken, refreshToken } =
      await this.jwtService.signAccessTokenAndRefreshToken(payload);

    this.jwtService.setRefreshTokenToCookie(res, refreshToken);

    return { user, accessToken };
  }

  async refresh(payload: JwtPayload): Promise<RefreshResponse> {
    const accessToken = await this.jwtService.signToken(payload, 'access');

    return { accessToken };
  }
}
