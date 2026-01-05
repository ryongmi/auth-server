import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

import { REDIS_CLIENT_TOKEN } from '@krgeobuk/database-config/constants';

import { REDIS_BASE_KEYS } from '@common/constants/index.js';
import { RedisConfig } from '@common/interfaces/index.js';

@Injectable()
export class RedisService {
  private readonly envPrefix: string;

  constructor(
    @Inject(REDIS_CLIENT_TOKEN) private readonly redisClient: Redis,
    private readonly configService: ConfigService
  ) {
    this.envPrefix = this.configService.get<RedisConfig['keyPrefix']>('redis.keyPrefix')!;
  }

  /**
   * Redis 키 생성 헬퍼 메서드
   * @param baseKey - 기본 키
   * @param id - 선택적 ID (접두사 키의 경우)
   * @returns 환경 prefix가 적용된 완전한 Redis 키
   */
  private buildKey(baseKey: string, id?: string | number): string {
    const key = id ? `${baseKey}:${id}` : baseKey;
    return this.envPrefix ? `${this.envPrefix}:${key}` : key;
  }

  // ==================== Private 범용 메서드 ====================

  /**
   * 만료 시간이 있는 값 저장
   * @private
   */
  private async setExValue(
    key: string,
    expire: number,
    value: string | number | Buffer
  ): Promise<void> {
    await this.redisClient.setex(key, expire, value);
  }

  /**
   * 값 저장
   * @private
   */
  private async setValue(key: string, value: string): Promise<void> {
    await this.redisClient.set(key, value);
  }

  /**
   * 값 조회
   * @private
   */
  private async getValue(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  /**
   * 값 삭제
   * @private
   */
  private async deleteValue(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  // ==================== OAuth 리다이렉트 세션 관리 ====================

  /**
   * OAuth 리다이렉트 세션 저장
   * @param sessionId - 세션 ID
   * @param redirectUri - 리다이렉트 URI
   * @param ttl - TTL (기본값: 300초 = 5분)
   */
  async setRedirectSession(sessionId: string, redirectUri: string, ttl = 300): Promise<void> {
    const sessionData = {
      redirectUri,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
    const key = this.buildKey(REDIS_BASE_KEYS.OAUTH.REDIRECT_SESSION_PREFIX, sessionId);
    await this.setExValue(key, ttl, JSON.stringify(sessionData));
  }

  /**
   * OAuth 리다이렉트 세션 조회
   * @param sessionId - 세션 ID
   * @returns 세션 데이터 또는 null
   */
  async getRedirectSession(
    sessionId: string
  ): Promise<{ redirectUri: string; createdAt: string; expiresAt: string } | null> {
    const key = this.buildKey(REDIS_BASE_KEYS.OAUTH.REDIRECT_SESSION_PREFIX, sessionId);
    const sessionData = await this.getValue(key);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  /**
   * OAuth 리다이렉트 세션 삭제
   * @param sessionId - 세션 ID
   */
  async deleteRedirectSession(sessionId: string): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.OAUTH.REDIRECT_SESSION_PREFIX, sessionId);
    await this.deleteValue(key);
  }

  // ==================== Naver OAuth State 관리 ====================

  /**
   * Naver OAuth State 저장
   * @param stateId - State ID
   * @param stateData - State 데이터 (기본값: 'pending')
   * @param ttl - TTL (기본값: 300초 = 5분)
   */
  async setNaverState(stateId: string, stateData = 'pending', ttl = 300): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.JWT.NAVER_STATE_PREFIX, stateId);
    await this.setExValue(key, ttl, stateData);
  }

  /**
   * Naver OAuth State 조회
   * @param stateId - State ID
   * @returns State 데이터 또는 null
   */
  async getNaverState(stateId: string): Promise<string | null> {
    const key = this.buildKey(REDIS_BASE_KEYS.JWT.NAVER_STATE_PREFIX, stateId);
    return await this.getValue(key);
  }

  /**
   * Naver OAuth State 삭제
   * @param stateId - State ID
   */
  async deleteNaverState(stateId: string): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.JWT.NAVER_STATE_PREFIX, stateId);
    await this.deleteValue(key);
  }

  // ==================== Google OAuth State 관리 ====================

  /**
   * Google OAuth State 저장
   * @param stateId - State ID
   * @param stateData - State 데이터 (기본값: 'pending')
   * @param ttl - TTL (기본값: 300초 = 5분)
   */
  async setGoogleState(stateId: string, stateData = 'pending', ttl = 300): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.JWT.GOOGLE_STATE_PREFIX, stateId);
    await this.setExValue(key, ttl, stateData);
  }

  /**
   * Google OAuth State 조회
   * @param stateId - State ID
   * @returns State 데이터 또는 null
   */
  async getGoogleState(stateId: string): Promise<string | null> {
    const key = this.buildKey(REDIS_BASE_KEYS.JWT.GOOGLE_STATE_PREFIX, stateId);
    return await this.getValue(key);
  }

  /**
   * Google OAuth State 삭제
   * @param stateId - State ID
   */
  async deleteGoogleState(stateId: string): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.JWT.GOOGLE_STATE_PREFIX, stateId);
    await this.deleteValue(key);
  }

  // ==================== JWT Refresh Token Store ====================

  /**
   * JWT Refresh Token 저장소 명칭 조회
   * 쿠키 스토어 이름으로 사용됩니다.
   * @returns 저장소 명칭 (예: "refreshToken", "dev:refreshToken")
   */
  getRefreshStoreName(): string {
    return this.buildKey(REDIS_BASE_KEYS.JWT.REFRESH_NAME);
  }

  // ==================== JWT 블랙리스트 관리 ====================

  /**
   * JWT 블랙리스트에 토큰 추가
   * @param tokenId - 토큰 ID 또는 JTI
   * @param ttl - TTL (초 단위)
   */
  async addToBlacklist(tokenId: string, ttl: number): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.JWT.BLACKLIST_PREFIX, tokenId);
    await this.setExValue(key, ttl, '1');
  }

  /**
   * JWT 블랙리스트 확인
   * @param tokenId - 토큰 ID 또는 JTI
   * @returns 블랙리스트 여부
   */
  async isBlacklisted(tokenId: string): Promise<boolean> {
    const key = this.buildKey(REDIS_BASE_KEYS.JWT.BLACKLIST_PREFIX, tokenId);
    const exists = await this.getValue(key);
    return exists !== null;
  }

  // ==================== 비밀번호 재설정 토큰 관리 ====================

  /**
   * 비밀번호 재설정 토큰 저장
   * @param token - UUID v4 토큰
   * @param userId - 사용자 ID
   * @param ttl - TTL (기본값: 3600초 = 1시간)
   */
  async setPasswordResetToken(token: string, userId: string, ttl = 3600): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.PASSWORD_RESET_PREFIX, token);
    await this.setExValue(key, ttl, userId);
  }

  /**
   * 비밀번호 재설정 토큰으로 사용자 ID 조회
   * @param token - UUID v4 토큰
   * @returns 사용자 ID 또는 null
   */
  async getPasswordResetToken(token: string): Promise<string | null> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.PASSWORD_RESET_PREFIX, token);
    return await this.getValue(key);
  }

  /**
   * 비밀번호 재설정 토큰 삭제 (일회성)
   * @param token - UUID v4 토큰
   */
  async deletePasswordResetToken(token: string): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.PASSWORD_RESET_PREFIX, token);
    await this.deleteValue(key);
  }

  // ==================== 계정 병합 토큰 관리 ====================

  /**
   * 계정 병합 확인 토큰 저장
   * @param requestId - 병합 요청 ID
   * @param token - 확인 토큰
   * @param ttl - TTL (기본값: 86400초 = 24시간)
   */
  async setMergeToken(requestId: number, token: string, ttl = 86400): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.MERGE_TOKEN_PREFIX, requestId);
    await this.setExValue(key, ttl, token);
  }

  /**
   * 계정 병합 확인 토큰 조회
   * @param requestId - 병합 요청 ID
   * @returns 확인 토큰 또는 null
   */
  async getMergeToken(requestId: number): Promise<string | null> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.MERGE_TOKEN_PREFIX, requestId);
    return await this.getValue(key);
  }

  /**
   * 계정 병합 확인 토큰 삭제
   * @param requestId - 병합 요청 ID
   */
  async deleteMergeToken(requestId: number): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.MERGE_TOKEN_PREFIX, requestId);
    await this.deleteValue(key);
  }

  // ==================== 이메일 인증 토큰 관리 ====================

  /**
   * 이메일 인증 토큰 저장
   * @param token - UUID v4 토큰
   * @param userId - 사용자 ID
   * @param ttl - TTL (기본값: 86400초 = 24시간)
   */
  async setEmailVerificationToken(token: string, userId: string, ttl = 86400): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.EMAIL_VERIFICATION_PREFIX, token);
    await this.setExValue(key, ttl, userId);
  }

  /**
   * 이메일 인증 토큰으로 사용자 ID 조회
   * @param token - UUID v4 토큰
   * @returns 사용자 ID 또는 null
   */
  async getEmailVerificationToken(token: string): Promise<string | null> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.EMAIL_VERIFICATION_PREFIX, token);
    return await this.getValue(key);
  }

  /**
   * 이메일 인증 토큰 삭제 (일회성)
   * @param token - UUID v4 토큰
   */
  async deleteEmailVerificationToken(token: string): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.EMAIL_VERIFICATION_PREFIX, token);
    await this.deleteValue(key);
  }
}
