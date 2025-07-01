import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Request, Response } from 'express';

import { OAuthAccountProviderType } from '@krgeobuk/oauth/enum';
import { AuthException } from '@krgeobuk/auth/exception';
import { UserError, UserException } from '@krgeobuk/user/exception';
import type {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthSignupRequest,
  AuthRefreshResponse,
} from '@krgeobuk/auth/interfaces';
import type { JwtPayload } from '@krgeobuk/jwt/interfaces';

import { RedisService } from '@database';
import { hashPassword, isPasswordMatching } from '@common/utils/index.js';
import { JwtTokenService } from '@common/jwt/index.js';
import { JwtConfig } from '@common/interfaces/index.js';

import { User, UserService } from '@modules/user/index.js';
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

  async issueTokens(res: Response, user: User, tokenData?: unknown): Promise<AuthLoginResponse> {
    this.logger.log(`${this.issueTokens.name} - 시작 되었습니다.`);

    const payload = tokenData
      ? {
          id: user.id,
          tokenData,
        }
      : {
          id: user.id,
        };

    const { accessToken, refreshToken } =
      await this.jwtService.signAccessTokenAndRefreshToken(payload);

    this.jwtService.setRefreshTokenToCookie(res, refreshToken);

    this.logger.log(`${this.issueTokens.name} - 성공적으로 종료되었습니다.`);

    return { accessToken, user };
  }

  async logout(req: Request, res: Response): Promise<void> {
    this.logger.log(`${this.logout.name} - 시작 되었습니다.`);

    const refreshToken = this.jwtService.getRefreshTokenToCookie(req);

    const blackListStore =
      this.configService.get<JwtConfig['blackListStore']>('jwt.blackListStore')!;
    const refreshMaxAge = this.configService.get<JwtConfig['refreshMaxAge']>('jwt.refreshMaxAge')!;

    await this.redisService.setExValue(`${blackListStore}${refreshToken}`, refreshMaxAge, 1); // Redis에 블랙리스트 지정

    this.jwtService.clearRefreshTokenCookie(res);

    this.logger.log(`${this.logout.name} - 성공적으로 종료되었습니다.`);
  }

  async login(res: Response, attrs: AuthLoginRequest): Promise<AuthLoginResponse> {
    this.logger.log(`${this.login.name} - 시작 되었습니다.`);

    const { email, password } = attrs;

    const user = (await this.userService.findByAnd({ email }))[0];
    if (!user) {
      const message = `[${this.login.name} Warn] code: ${UserError.USER_NOT_FOUND.code}, Message: ${UserError.USER_NOT_FOUND.message}`;
      this.logger.warn(message);
      throw UserException.invalidCredentials();
    }

    // 생각해보니 이 메서드는 홈페이지 로그인에서만 사용할거라 아래 조건이 필요가없음
    // const userProvider = user.oauthAccount.provider;
    // const isHomepageOrIntegratedUser =
    //   userProvider === OAuthAccountProviderType.HOMEPAGE || userProvider === OAuthAccountProviderType.INTEGRATE;

    // // 홈페이지 또는 통합 아이디만 홈페이지 로그인 가능
    // if (!isHomepageOrIntegratedUser) {
    //   throw UserException.userNotFound();
    // }

    const isMatch = isPasswordMatching(password, user.password ?? '');
    if (!isMatch) {
      const message = `[${this.login.name} Warn] code: ${UserError.PASSWORD_INCORRECT.code}, Message: ${UserError.PASSWORD_INCORRECT.message}`;
      this.logger.warn(message);
      throw UserException.invalidCredentials();
    }

    // 마지막 로그인 날짜 기록
    // await this.userService.lastLoginUpdate(user.id);

    // const payload = {
    //   id: user.id,
    // };

    try {
      const { accessToken } = await this.issueTokens(res, user);

      this.logger.log(`${this.login.name} - 성공적으로 종료되었습니다.`);
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

  async signup(res: Response, attrs: AuthSignupRequest): Promise<AuthLoginResponse> {
    this.logger.log(`${this.signup.name} - 시작 되었습니다.`);

    const { email, password } = attrs;

    const findUser = (await this.userService.findByAnd({ email }))[0];
    if (findUser) throw UserException.emailAlreadyExists();

    const hashedPassword = await hashPassword(password);
    const createUserAttrs = { ...attrs, password: hashedPassword };

    try {
      const createdUser = await this.dataSource.transaction(async (manager) => {
        const createdUser = await this.userService.createUser(createUserAttrs, manager);

        this.logger.log(`${this.signup.name} - 유저생성완료`);

        const oauthAccountAttrs = {
          provider: OAuthAccountProviderType.HOMEPAGE,
          userId: createdUser.id,
        };
        // const oauthAccount = await this.oauthService.createOAuthAccount(oauthAccountAttrs, manager);
        await this.oauthService.createOAuthAccount(oauthAccountAttrs, manager);

        this.logger.log(`${this.signup.name} - OAuthAccount 생성완료`);

        return createdUser;
      });

      // const payload = {
      //   id: createdUser.id,
      //   // provider: oauthAccount.provider,
      // };

      const { accessToken } = await this.issueTokens(res, createdUser);

      this.logger.log(`${this.signup.name} - 성공적으로 종료되었습니다.`);

      return { user: createdUser, accessToken };
    } catch (error: unknown) {
      const message = `[${this.signup.name} Error] ${error instanceof Error ? error.message : String(error)}`;
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(message, stack);

      throw AuthException.signupError();
    }
  }

  async refresh(payload: JwtPayload): Promise<AuthRefreshResponse> {
    this.logger.log(`${this.refresh.name} - 시작 되었습니다.`);

    try {
      const accessToken = await this.jwtService.signToken(payload, 'access');

      this.logger.log(`${this.refresh.name} - 성공적으로 종료되었습니다.`);

      return { accessToken };
    } catch (error: unknown) {
      const message = `[${this.refresh.name} Error] ${error instanceof Error ? error.message : String(error)}`;
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(message, stack);

      throw AuthException.refreshError();
    }
  }
}
