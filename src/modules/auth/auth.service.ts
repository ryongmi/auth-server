import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EntityManager } from 'typeorm';
import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import { AuthException } from '@krgeobuk/auth/exception';
import { EmailException } from '@krgeobuk/email/exception';
import { UserError, UserException } from '@krgeobuk/user/exception';
import type {
  AuthLoginRequest,
  AuthSignupRequest,
  AuthRefreshResponse,
  AuthInitializeResponse,
} from '@krgeobuk/auth/interfaces';
import type { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { EmailService } from '@krgeobuk/email/services';
import type { EmailConfig } from '@krgeobuk/email/interfaces';

import { RedisService } from '@database/redis/redis.service.js';
import { hashPassword, isPasswordMatching } from '@common/utils/index.js';
import { JwtTokenService } from '@common/jwt/index.js';
import { RedirectValidationService } from '@common/security/index.js';
import { DefaultConfig, JwtConfig } from '@common/interfaces/index.js';
import { UserService } from '@modules/user/index.js';
import { OAuthService } from '@modules/oauth/index.js';
import { EmailVerificationService } from '@modules/email-verification/index.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtTokenService,
    private readonly oauthService: OAuthService,
    private readonly emailService: EmailService,
    private readonly redirectValidation: RedirectValidationService,
    private readonly emailVerificationService: EmailVerificationService
  ) {}

  async logout(req: Request, res: Response): Promise<void> {
    this.logger.log(`${this.logout.name} - 시작 되었습니다.`);

    const refreshToken = this.jwtService.getRefreshTokenToCookie(req);
    const refreshMaxAge = this.configService.get<JwtConfig['refreshMaxAge']>('jwt.refreshMaxAge')!;

    await this.redisService.addToBlacklist(refreshToken, refreshMaxAge); // Redis에 블랙리스트 지정

    this.jwtService.clearRefreshTokenCookie(res);

    this.logger.log(`${this.logout.name} - 성공적으로 종료되었습니다.`);
  }

  async login(res: Response, attrs: AuthLoginRequest, redirectSession: string): Promise<string> {
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

    // 이메일 미인증 사용자도 로그인 허용
    // isEmailVerified 필드는 사용자 선택적 인증 용도로 유지

    // 마지막 로그인 날짜 기록
    // await this.userService.lastLoginUpdate(user.id);

    const payload = {
      sub: user.id,
    };

    try {
      const { accessToken, refreshToken } =
        await this.jwtService.signAccessTokenAndRefreshToken(payload);

      this.jwtService.setRefreshTokenToCookie(res, refreshToken);

      // SSO 리다이렉트 처리 (필수)
      const redirectUrl = await this.handleSSORedirect(redirectSession, accessToken, refreshToken);

      this.logger.log(`${this.login.name} - SSO 리다이렉트로 종료되었습니다.`);
      return redirectUrl || this.redirectValidation.getDefaultRedirectUrl();
    } catch (error: unknown) {
      // 내부 로그: JWT 에러 상세 정보
      const internalMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(
        `[AUTH_LOGIN_JWT_ERROR] JWT 토큰 생성 실패 - Internal: ${internalMessage}`,
        {
          action: 'login',
          userId: payload.sub,
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
    redirectSession: string,
    transactionManager: EntityManager
  ): Promise<string> {
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

      // 이메일 인증 메일 발송 (비동기로 처리하여 회원가입 플로우에 영향 없도록)
      this.emailVerificationService
        .sendVerificationEmail(createdUser.id, createdUser.email, createdUser.name)
        .catch((error) => {
          this.logger.error(
            `[AUTH_SIGNUP] 이메일 인증 메일 발송 실패 - userId: ${createdUser.id}`,
            {
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          );
        });

      this.logger.log(`${this.signup.name} - 이메일 인증 메일 발송 요청 완료`);

      const payload = {
        sub: createdUser.id,
        // provider: oauthAccount.provider,
      };

      const { accessToken, refreshToken } =
        await this.jwtService.signAccessTokenAndRefreshToken(payload);

      this.jwtService.setRefreshTokenToCookie(res, refreshToken);

      // SSO 리다이렉트 처리 (필수)
      const redirectUrl = await this.handleSSORedirect(redirectSession, accessToken, refreshToken);

      this.logger.log(`${this.signup.name} - SSO 리다이렉트로 종료되었습니다.`);
      return redirectUrl || this.redirectValidation.getDefaultRedirectUrl();
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
        userId: payload.sub,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        stack,
      });

      // 클라이언트용: 일반화된 에러 메시지
      throw AuthException.refreshError();
    }
  }

  async initialize(payload: JwtPayload): Promise<AuthInitializeResponse> {
    this.logger.log(`${this.initialize.name} - 시작 되었습니다.`);

    try {
      // AccessToken 재발급
      const accessToken =
        payload.sub === '' ? '' : await this.jwtService.signToken(payload, 'access');

      // 사용자 프로필 정보 조회
      const user = await this.userService.getMyProfile(payload.sub);

      this.logger.log(`${this.initialize.name} - 성공적으로 종료되었습니다.`);

      return { accessToken, user };
    } catch (error: unknown) {
      // 내부 로그: 초기화 에러 상세 정보
      const internalMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(`[AUTH_INITIALIZE_ERROR] 초기화 실패 - Internal: ${internalMessage}`, {
        action: 'initialize',
        userId: payload.sub,
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
  async ssoLoginRedirect(redirectUri: string, req?: Request): Promise<string> {
    this.logger.log(`${this.ssoLoginRedirect.name} - 시작 되었습니다.`);

    // 리다이렉트 URI 검증
    const isValidRedirect = await this.redirectValidation.validateRedirectUri(redirectUri, req);
    if (!isValidRedirect) {
      this.logger.warn(`[SSO_REDIRECT_ERROR] 잘못된 리다이렉트 URI: ${redirectUri}`);
      throw AuthException.invalidRedirectUri();
    }

    // 리다이렉트 세션 생성
    const redirectSession = uuid();
    await this.redisService.setRedirectSession(redirectSession, redirectUri, 300);

    // Auth Client로 리다이렉트
    const authClientUrl = this.configService.get<DefaultConfig['authClientUrl']>('authClientUrl')!;
    const authLoginUrl = `${authClientUrl}/login?redirect_session=${redirectSession}`;

    this.logger.log(`${this.ssoLoginRedirect.name} - Auth Client로 리다이렉트: ${authLoginUrl}`);

    return authLoginUrl;
  }

  /**
   * SSO 리다이렉트 처리
   */
  private async handleSSORedirect(
    redirectSession: string,
    _accessToken: string,
    _refreshToken: string
  ): Promise<string | null> {
    const sessionData = await this.redisService.getRedirectSession(redirectSession);

    if (sessionData) {
      const { redirectUri } = sessionData;

      // 세션 정리
      await this.redisService.deleteRedirectSession(redirectSession);

      // 원래 서비스로 리다이렉트
      const callbackUrl = `${redirectUri}`;
      return callbackUrl;
    }

    return null;
  }

  // ==================== 비밀번호 재설정 관련 메서드 ====================

  /**
   * 비밀번호 재설정 요청 (이메일 발송)
   */
  async requestPasswordReset(email: string): Promise<void> {
    this.logger.log(`${this.requestPasswordReset.name} - 시작되었습니다.`);

    // 사용자 존재 확인
    const user = (await this.userService.findByAnd({ email }))[0];
    if (!user) {
      throw UserException.userNotFound();
    }

    // 이메일 발송
    await this.sendPasswordResetEmail(user.id, user.email, user.name);

    this.logger.log(`${this.requestPasswordReset.name} - 비밀번호 재설정 이메일 발송 완료`);
  }

  /**
   * 비밀번호 재설정 실행
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    this.logger.log(`${this.resetPassword.name} - 시작되었습니다.`);

    // Redis에서 토큰 조회
    const userId = await this.redisService.getPasswordResetToken(token);
    if (!userId) {
      throw AuthException.passwordResetTokenInvalid();
    }

    // 사용자 조회
    const user = await this.userService.findById(userId);
    if (!user) {
      throw UserException.userNotFound();
    }

    // 새 비밀번호 해싱
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;

    // 비밀번호 업데이트
    await this.userService.updateUser(user);

    // 토큰 삭제 (일회성)
    await this.redisService.deletePasswordResetToken(token);

    this.logger.log(`${this.resetPassword.name} - 비밀번호 재설정 완료`, { userId });
  }

  /**
   * 비밀번호 재설정 이메일 발송 (내부 메서드)
   */
  private async sendPasswordResetEmail(userId: string, email: string, name: string): Promise<void> {
    this.logger.log(`${this.sendPasswordResetEmail.name} - 시작되었습니다.`);

    // UUID 토큰 생성
    const token = uuid();

    // 이메일 설정 가져오기
    const emailConfig = this.configService.get<EmailConfig>('email');
    const expiresIn = 3600; // 1시간
    const resetUrl = `${emailConfig?.verification?.baseUrl}/reset-password?token=${token}`;

    // Redis에 토큰 저장
    await this.redisService.setPasswordResetToken(token, userId, expiresIn);

    // 이메일 발송
    try {
      await this.emailService.sendPasswordResetEmail({
        to: email,
        name,
        resetUrl,
      });
      this.logger.log(`${this.sendPasswordResetEmail.name} - 이메일 발송 성공`, { email, userId });
    } catch (error) {
      // 이메일 발송 실패 시 토큰 삭제
      await this.redisService.deletePasswordResetToken(token);

      this.logger.error(`${this.sendPasswordResetEmail.name} - 이메일 발송 실패`, {
        email,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw EmailException.sendFailed();
    }
  }
}
