import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

import { OAuthException } from '@krgeobuk/oauth/exception';
import { ProviderType } from '@krgeobuk/oauth/enum';

import { OAuthService } from '../oauth.service.js';

@Injectable()
export class NaverOAuthStateGuard implements CanActivate {
  constructor(private readonly oauthService: OAuthService) {} // RedisService 주입

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { error, state } = request.query; // 요청에서 state 값을 가져옴

    // error 값이 있으면 예외 처리
    if (error) {
      const { error_description } = request.query;
      console.log(`${NaverOAuthStateGuard.name} Error: ${error}, ErrorMsg: ${error_description}`);
      throw OAuthException.loginError(ProviderType.NAVER);
    }

    // state 값이 없으면 예외 처리
    if (!state) throw OAuthException.stateNotFound(ProviderType.NAVER);

    // state 값이 유효한지 Redis에서 확인
    const isValidState = await this.oauthService.validateState(state, ProviderType.NAVER);

    if (!isValidState) throw OAuthException.stateExpired(ProviderType.NAVER);

    // 유효성 검사 끝난 state 레디스에서 삭제
    await this.oauthService.deleteState(state, ProviderType.NAVER);

    return true;
  }
}

@Injectable()
export class GoogleOAuthStateGuard implements CanActivate {
  constructor(private readonly oauthService: OAuthService) {} // RedisService 주입

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { error, state } = request.query; // 요청에서 state 값을 가져옴

    // error 값이 있으면 예외 처리
    if (error) {
      console.log(`${GoogleOAuthStateGuard.name} Error: ${error}`);
      throw OAuthException.loginError(ProviderType.GOOGLE);
    }

    // state 값이 없으면 예외 처리
    if (!state) throw OAuthException.stateNotFound(ProviderType.GOOGLE);

    // state 값이 유효한지 Redis에서 확인
    const isValidState = await this.oauthService.validateState(state, ProviderType.GOOGLE);

    if (!isValidState) throw OAuthException.stateExpired(ProviderType.GOOGLE);

    // 유효성 검사 끝난 state 레디스에서 삭제
    await this.oauthService.deleteState(state, ProviderType.GOOGLE);

    return true;
  }
}
