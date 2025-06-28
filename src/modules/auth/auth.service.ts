import { Injectable, Logger } from '@nestjs/common';
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
import { AuthException } from '@krgeobuk/auth/exception';
import { UserException } from '@krgeobuk/user/exception';
import type { JwtPayload } from '@krgeobuk/jwt/interfaces';

import { RedisService } from '@database';
import { hashPassword, isPasswordMatching } from '@common/utils/index.js';
import { JwtTokenService } from '@common/jwt/index.js';
import { JwtConfig } from '@common/interfaces/index.js';

import { UserService } from '@modules/user/index.js';
import { OAuthService } from '@modules/oauth/index.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtTokenService,
    private readonly oauthService: OAuthService
  ) {}

  async logout(req: Request, res: Response): Promise<void> {
    this.logger.log(`${this.logout.name} 시작`);

    const refreshToken = this.jwtService.getRefreshTokenToCookie(req);

    const blackListStore =
      this.configService.get<JwtConfig['blackListStore']>('jwt.blackListStore')!;
    const refreshMaxAge = this.configService.get<JwtConfig['refreshMaxAge']>('jwt.refreshMaxAge')!;

    await this.redisService.setExValue(`${blackListStore}${refreshToken}`, refreshMaxAge, 1); // Redis에 블랙리스트 지정

    this.jwtService.clearRefreshTokenCookie(res);

    this.logger.log(`${this.logout.name} 끝`);
  }

  async login(res: Response, attrs: LoginRequest): Promise<LoginResponse> {
    this.logger.log(`${this.login.name} 시작`);

    const { email, password } = attrs;

    const user = await this.userService.findUserByEmail(email);
    if (!user) throw UserException.userNotFound();

    // 생각해보니 이 메서드는 홈페이지 로그인에서만 사용할거라 아래 조건이 필요가없음
    // const userProvider = user.oauthAccount.provider;
    // const isHomepageOrIntegratedUser =
    //   userProvider === ProviderType.HOMEPAGE || userProvider === ProviderType.INTEGRATE;

    // // 홈페이지 또는 통합 아이디만 홈페이지 로그인 가능
    // if (!isHomepageOrIntegratedUser) {
    //   throw UserException.userNotFound();
    // }

    const isMatch = isPasswordMatching(password, user.password ?? '');
    if (!isMatch) throw UserException.passwordIncorrect();

    // 마지막 로그인 날짜 기록
    // await this.userService.lastLoginUpdate(user.id);

    const payload = {
      id: user.id,
    };

    try {
      const { accessToken, refreshToken } =
        await this.jwtService.signAccessTokenAndRefreshToken(payload);

      this.jwtService.setRefreshTokenToCookie(res, refreshToken);

      this.logger.log(`${this.login.name} 끝`);
      // return await this.userService.lastLoginUpdate(user);
      return { user, accessToken };
    } catch (error: unknown) {
      const message = `[${this.login.name} > JWT Error] ${error instanceof Error ? error.message : String(error)}`;
      const stack = error instanceof Error ? error.stack : '';
      // console.error(`[${this.login.name} > JWT Error] ${message}\n${stack}`);
      this.logger.error(message, stack);

      throw AuthException.loginError();
    }
  }

  async signup(res: Response, attrs: SignupRequest): Promise<LoginResponse> {
    this.logger.log(`${this.signup.name} 시작`);

    const { email, password } = attrs;

    const findUser = await this.userService.findUserByEmail(email);
    if (findUser) throw UserException.emailAlreadyExists();

    const hashedPassword = await hashPassword(password);
    const createUserAttrs = { ...attrs, password: hashedPassword };

    try {
      const createdUser = await this.dataSource.transaction(async (manager) => {
        const createdUser = await this.userService.createUser(createUserAttrs, manager);

        this.logger.log(`${this.signup.name} - 유저생성완료`);

        const oauthAccountAttrs = {
          provider: ProviderType.HOMEPAGE,
          userId: createdUser.id,
        };
        // const oauthAccount = await this.oauthService.createOAuthAccount(oauthAccountAttrs, manager);
        await this.oauthService.createOAuthAccount(oauthAccountAttrs, manager);

        this.logger.log(`${this.signup.name} OAuthAccount 생성완료`);

        return createdUser;
      });

      const payload = {
        id: createdUser.id,
        // provider: oauthAccount.provider,
      };

      const { accessToken, refreshToken } =
        await this.jwtService.signAccessTokenAndRefreshToken(payload);

      this.jwtService.setRefreshTokenToCookie(res, refreshToken);

      this.logger.log(`${this.signup.name} 끝`);

      return { user: createdUser, accessToken };
    } catch (error: unknown) {
      const message = `[${this.signup.name} Error] ${error instanceof Error ? error.message : String(error)}`;
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(message, stack);

      throw AuthException.signupError();
    }
  }

  async refresh(payload: JwtPayload): Promise<RefreshResponse> {
    this.logger.log(`${this.refresh.name} 시작`);

    try {
      const accessToken = await this.jwtService.signToken(payload, 'access');

      this.logger.log(`${this.refresh.name} 끝`);

      return { accessToken };
    } catch (error: unknown) {
      const message = `[${this.refresh.name} Error] ${error instanceof Error ? error.message : String(error)}`;
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(message, stack);

      throw AuthException.refreshError();
    }
  }
}
