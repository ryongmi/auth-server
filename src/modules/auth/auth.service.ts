import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EntityManager } from 'typeorm';
import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import { AuthException } from '@krgeobuk/auth/exception';
import { UserError, UserException } from '@krgeobuk/user/exception';
import type {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthSignupRequest,
  AuthRefreshResponse,
} from '@krgeobuk/auth/interfaces';
import type { JwtPayload } from '@krgeobuk/jwt/interfaces';

import { RedisService } from '@database/index.js';
import { hashPassword, isPasswordMatching } from '@common/utils/index.js';
import { JwtTokenService } from '@common/jwt/index.js';
import { DefaultConfig, JwtConfig } from '@common/interfaces/index.js';
import { UserService } from '@modules/user/index.js';
import { OAuthService } from '@modules/oauth/index.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtTokenService,
    private readonly oauthService: OAuthService
  ) {}

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

  async login(
    res: Response,
    attrs: AuthLoginRequest,
    redirectSession?: string
  ): Promise<AuthLoginResponse | string> {
    this.logger.log(`${this.login.name} - 시작 되었습니다.`);

    const { email, password } = attrs;

    const user = (await this.userService.findByAnd({ email }))[0];
    if (!user) {
      // 내부 로그: 상세한 정보 (이메일 해시화 고려)
      this.logger.warn(
        `[AUTH_LOGIN_FAILED] 사용자 찾기 실패 - code: ${UserError.USER_NOT_FOUND.code}`,
        {
          action: 'login',
          reason: 'user_not_found',
          emailHash: email ? email.substring(0, 3) + '***' : 'unknown', // 이메일 마스킹
        }
      );
      // 클라이언트용: 보안을 위한 일반화된 메시지
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
      // 내부 로그: 상세한 정보
      this.logger.warn(
        `[AUTH_LOGIN_FAILED] 비밀번호 불일치 - code: ${UserError.PASSWORD_INCORRECT.code}`,
        {
          action: 'login',
          reason: 'password_incorrect',
          userId: user.id,
          emailHash: email ? email.substring(0, 3) + '***' : 'unknown',
        }
      );
      // 클라이언트용: 보안을 위한 일반화된 메시지
      throw UserException.invalidCredentials();
    }

    // 마지막 로그인 날짜 기록
    // await this.userService.lastLoginUpdate(user.id);

    const payload = {
      id: user.id,
    };

    try {
      const { accessToken, refreshToken } =
        await this.jwtService.signAccessTokenAndRefreshToken(payload);

      this.jwtService.setRefreshTokenToCookie(res, refreshToken);

      // SSO 리다이렉트 처리
      if (redirectSession) {
        const redirectUrl = await this.handleSSORedirect(
          redirectSession,
          accessToken,
          refreshToken
        );
        if (redirectUrl) {
          this.logger.log(`${this.login.name} - SSO 리다이렉트로 종료되었습니다.`);
          return redirectUrl;
        }
      }

      this.logger.log(`${this.login.name} - 성공적으로 종료되었습니다.`);
      // return await this.userService.lastLoginUpdate(user);
      return { user, accessToken };
    } catch (error: unknown) {
      // 내부 로그: JWT 에러 상세 정보
      const internalMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(
        `[AUTH_LOGIN_JWT_ERROR] JWT 토큰 생성 실패 - Internal: ${internalMessage}`,
        {
          action: 'login',
          userId: payload.id,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          stack,
        }
      );

      // 클라이언트용: 일반화된 에러 메시지
      throw AuthException.loginError();
    }
  }

  async signup(
    res: Response,
    attrs: AuthSignupRequest,
    transactionManager: EntityManager
  ): Promise<AuthLoginResponse> {
    this.logger.log(`${this.signup.name} - 시작 되었습니다.`);

    const { email, password } = attrs;

    const findUser = (await this.userService.findByAnd({ email }))[0];
    if (findUser) throw UserException.emailAlreadyExists();

    const hashedPassword = await hashPassword(password);
    const createUserAttrs = { ...attrs, password: hashedPassword };

    try {
      const createdUser = await this.userService.createUser(createUserAttrs, transactionManager);

      this.logger.log(`${this.signup.name} - 유저생성완료`);

      const oauthAccountAttrs = {
        provider: OAuthAccountProviderType.HOMEPAGE,
        userId: createdUser.id,
      };
      await this.oauthService.createOAuthAccount(oauthAccountAttrs, transactionManager);

      this.logger.log(`${this.signup.name} - OAuthAccount 생성완료`);

      const payload = {
        id: createdUser.id,
        // provider: oauthAccount.provider,
      };

      const { accessToken, refreshToken } =
        await this.jwtService.signAccessTokenAndRefreshToken(payload);

      this.jwtService.setRefreshTokenToCookie(res, refreshToken);

      this.logger.log(`${this.signup.name} - 성공적으로 종료되었습니다.`);

      return { user: createdUser, accessToken };
    } catch (error: unknown) {
      // 내부 로그: 회원가입 에러 상세 정보
      const internalMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(`[AUTH_SIGNUP_ERROR] 회원가입 실패 - Internal: ${internalMessage}`, {
        action: 'signup',
        email: attrs.email ? attrs.email.substring(0, 3) + '***' : 'unknown', // 이메일 마스킹
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        stack,
      });

      // 클라이언트용: 일반화된 에러 메시지
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
      // 내부 로그: 토큰 새로고침 에러 상세 정보
      const internalMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(`[AUTH_REFRESH_ERROR] 토큰 새로고침 실패 - Internal: ${internalMessage}`, {
        action: 'refresh',
        userId: payload.id,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        stack,
      });

      // 클라이언트용: 일반화된 에러 메시지
      throw AuthException.refreshError();
    }
  }

  /**
   * SSO 로그인 리다이렉트 처리
   */
  async ssoLoginRedirect(redirectUri: string, res: Response): Promise<void> {
    this.logger.log(`${this.ssoLoginRedirect.name} - 시작 되었습니다.`);

    // 리다이렉트 URI 검증
    const isValidRedirect = await this.validateRedirectUri(redirectUri);
    if (!isValidRedirect) {
      this.logger.warn(`[SSO_REDIRECT_ERROR] 잘못된 리다이렉트 URI: ${redirectUri}`);
      throw new BadRequestException('Invalid redirect URI');
    }

    // 리다이렉트 세션 생성
    const redirectSession = uuid();
    await this.redisService.setRedirectSession(redirectSession, redirectUri, 300);

    // Portal Client로 리다이렉트
    const authClientUrl = this.configService.get<DefaultConfig['authClientUrl']>('authClientUrl')!;
    const authLoginUrl = `${authClientUrl}/login?redirect_session=${redirectSession}`;

    this.logger.log(
      `${this.ssoLoginRedirect.name} - Auth Client로 리다이렉트: ${authLoginUrl}`
    );
    res.redirect(authLoginUrl);
  }

  /**
   * SSO 리다이렉트 처리
   */
  private async handleSSORedirect(
    redirectSession: string,
    accessToken: string,
    refreshToken: string
  ): Promise<string | null> {
    const sessionData = await this.redisService.getRedirectSession(redirectSession);

    if (sessionData) {
      const { redirectUri } = sessionData;

      // 세션 정리
      await this.redisService.deleteRedirectSession(redirectSession);

      // 원래 서비스로 리다이렉트 (토큰 포함)
      const callbackUrl = `${redirectUri}?token=${accessToken}&refresh_token=${refreshToken}`;
      return callbackUrl;
    }

    return null;
  }

  /**
   * 리다이렉트 URI 검증
   */
  private async validateRedirectUri(redirectUri: string): Promise<boolean> {
    const allowedDomains = [
      'localhost',
      '127.0.0.1',
      'krgeobuk.com',
      'service1.krgeobuk.com',
      'service2.krgeobuk.com',
      // 허용된 도메인들 추가
    ];

    try {
      const url = new URL(redirectUri);
      const hostname = url.hostname;

      // 허용된 도메인 확인
      return allowedDomains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }
}
