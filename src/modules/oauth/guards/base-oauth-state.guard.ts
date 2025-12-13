import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';

import { OAuthException } from '@krgeobuk/oauth/exception';
import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';

import { OAuthService } from '../oauth.service.js';

/**
 * OAuth State 검증을 위한 추상 베이스 가드 클래스
 * 공통 로직을 정의하고 각 제공자별 세부사항은 하위 클래스에서 구현
 */
@Injectable()
export abstract class BaseOAuthStateGuard implements CanActivate {
  protected readonly logger: Logger;

  constructor(
    protected readonly oauthService: OAuthService,
    protected readonly providerType: OAuthAccountProviderType
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { error, state } = request.query;

    // 1. OAuth 에러 처리
    if (error) {
      this.handleOAuthError(error, request.query);

      // 사용자 취소 감지: access_denied는 사용자가 OAuth 권한을 거부한 경우
      if (error === 'access_denied') {
        throw OAuthException.cancelled(this.providerType);
      }

      throw OAuthException.loginError(this.providerType);
    }

    // 2. State 값 존재 확인
    if (!state) {
      throw OAuthException.stateNotFound(this.providerType);
    }

    // 3. State 값 유효성 검증
    const isValidState = await this.oauthService.validateState(state, this.providerType);
    if (!isValidState) {
      throw OAuthException.stateExpired(this.providerType);
    }

    // 4. 검증 완료된 State 삭제 - state에 redirectUrl, mode 추가로 삭제 안함
    // await this.oauthService.deleteState(state, this.providerType);

    return true;
  }

  /**
   * 각 제공자별 에러 처리 방식을 정의하는 추상 메서드
   * @param error OAuth 에러 코드
   * @param query 요청 쿼리 파라미터
   */
  protected abstract handleOAuthError(error: string, query: Record<string, unknown>): void;
}
