import { Injectable, Logger } from '@nestjs/common';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import { OAuthException } from '@krgeobuk/oauth/exception';

import { RedisService } from '@database/redis/redis.service.js';

/**
 * OAuth State 관리 서비스
 * CSRF 방지를 위한 OAuth State 값 생성, 검증, 저장 관리
 */
@Injectable()
export class OAuthStateService {
  private readonly logger = new Logger(OAuthStateService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * OAuth State 값 생성 및 Redis 저장
   * @param type - OAuth 제공자 타입 (GOOGLE, NAVER)
   * @param stateData - State에 저장할 데이터 (JSON 문자열 또는 일반 문자열)
   * @returns 생성된 state 값
   */
  async generateState(type: OAuthAccountProviderType, stateData?: string): Promise<string> {
    this.logger.log(`${this.generateState.name} - 시작 되었습니다.`);

    // const state = randomBytes(16).toString('hex');
    const state = Math.random().toString(36).substring(2, 15); // 랜덤 문자열 생성

    const data = stateData || 'pending';

    if (type === OAuthAccountProviderType.NAVER) {
      await this.redisService.setNaverState(state, data, 300);
    } else if (type === OAuthAccountProviderType.GOOGLE) {
      await this.redisService.setGoogleState(state, data, 300);
    } else {
      throw OAuthException.unsupportedProvider(type);
    }

    this.logger.log(`${this.generateState.name} - 성공적으로 종료되었습니다.`);

    return state; // 생성된 state 반환
  }

  /**
   * OAuth State 값 유효성 검증
   * @param state - 검증할 state 값
   * @param type - OAuth 제공자 타입
   * @returns state가 유효하면 true, 아니면 false
   */
  async validateState(state: string, type: OAuthAccountProviderType): Promise<boolean> {
    this.logger.log(`${this.validateState.name} - 시작 되었습니다.`);

    let value: string | null;

    if (type === OAuthAccountProviderType.NAVER) {
      value = await this.redisService.getNaverState(state);
    } else if (type === OAuthAccountProviderType.GOOGLE) {
      value = await this.redisService.getGoogleState(state);
    } else {
      throw OAuthException.unsupportedProvider(type);
    }

    this.logger.log(`${this.validateState.name} - 성공적으로 종료되었습니다.`);

    return value !== null; // state가 존재하면 유효한 state
  }

  /**
   * OAuth State에서 저장된 데이터 파싱
   * @param state - state 값
   * @param type - OAuth 제공자 타입
   * @returns 파싱된 데이터 객체 (mode, userId, redirectSession 등)
   */
  async getStateData(
    state: string,
    type: OAuthAccountProviderType
  ): Promise<{
    mode?: string;
    userId?: string;
    redirectSession?: string;
  } | null> {
    this.logger.log(`${this.getStateData.name} - 시작 되었습니다.`);

    let value: string | null;

    if (type === OAuthAccountProviderType.NAVER) {
      value = await this.redisService.getNaverState(state);
    } else if (type === OAuthAccountProviderType.GOOGLE) {
      value = await this.redisService.getGoogleState(state);
    } else {
      throw OAuthException.unsupportedProvider(type);
    }

    if (!value) return null;

    // JSON 형식인 경우 파싱
    try {
      const parsed = JSON.parse(value);
      this.logger.log(`${this.getStateData.name} - 성공적으로 종료되었습니다.`);
      return parsed;
    } catch {
      // JSON이 아닌 경우 null 반환
      this.logger.log(`${this.getStateData.name} - 성공적으로 종료되었습니다.`);
      return null;
    }
  }

  /**
   * OAuth 인증 후 State 삭제
   * @param state - 삭제할 state 값
   * @param type - OAuth 제공자 타입
   */
  async deleteState(state: string, type: OAuthAccountProviderType): Promise<void> {
    this.logger.log(`${this.deleteState.name} - 시작 되었습니다.`);

    if (type === OAuthAccountProviderType.NAVER) {
      await this.redisService.deleteNaverState(state);
    } else if (type === OAuthAccountProviderType.GOOGLE) {
      await this.redisService.deleteGoogleState(state);
    } else {
      throw OAuthException.unsupportedProvider(type);
    }

    this.logger.log(`${this.deleteState.name} - 성공적으로 종료되었습니다.`);
  }
}
