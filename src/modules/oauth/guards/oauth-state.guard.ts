import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';

import { OAuthException } from '@krgeobuk/oauth/exception';
import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';

import { OAuthService } from '../oauth.service.js';

@Injectable()
export class NaverOAuthStateGuard implements CanActivate {
  private readonly logger = new Logger(NaverOAuthStateGuard.name);

  constructor(private readonly oauthService: OAuthService) {} // RedisService 주입

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { error, state } = request.query; // 요청에서 state 값을 가져옴

    // error 값이 있으면 예외 처리
    if (error) {
      const { error_description } = request.query;
      const message = `Error: ${error}, ErrorMsg: ${error_description}`;

      this.logger.error(message);

      throw OAuthException.loginError(OAuthAccountProviderType.NAVER);
    }

    // state 값이 없으면 예외 처리
    if (!state) throw OAuthException.stateNotFound(OAuthAccountProviderType.NAVER);

    // state 값이 유효한지 Redis에서 확인
    const isValidState = await this.oauthService.validateState(
      state,
      OAuthAccountProviderType.NAVER
    );

    if (!isValidState) throw OAuthException.stateExpired(OAuthAccountProviderType.NAVER);

    // 유효성 검사 끝난 state 레디스에서 삭제
    await this.oauthService.deleteState(state, OAuthAccountProviderType.NAVER);

    return true;
  }
}

@Injectable()
export class GoogleOAuthStateGuard implements CanActivate {
  private readonly logger = new Logger(GoogleOAuthStateGuard.name);

  constructor(private readonly oauthService: OAuthService) {} // RedisService 주입

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { error, state } = request.query; // 요청에서 state 값을 가져옴

    // error 값이 있으면 예외 처리
    if (error) {
      const message = `Error: ${error}`;

      this.logger.error(message);

      throw OAuthException.loginError(OAuthAccountProviderType.GOOGLE);
    }

    // state 값이 없으면 예외 처리
    if (!state) throw OAuthException.stateNotFound(OAuthAccountProviderType.GOOGLE);

    // state 값이 유효한지 Redis에서 확인
    const isValidState = await this.oauthService.validateState(
      state,
      OAuthAccountProviderType.GOOGLE
    );

    if (!isValidState) throw OAuthException.stateExpired(OAuthAccountProviderType.GOOGLE);

    // 유효성 검사 끝난 state 레디스에서 삭제
    await this.oauthService.deleteState(state, OAuthAccountProviderType.GOOGLE);

    return true;
  }
}
