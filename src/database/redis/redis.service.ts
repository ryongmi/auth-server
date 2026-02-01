import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

import { BaseRedisService } from '@krgeobuk/database-config/redis';
import { REDIS_CLIENT_TOKEN } from '@krgeobuk/database-config/constants';

import { REDIS_BASE_KEYS } from '@common/constants/index.js';
import { RedisConfig } from '@common/interfaces/index.js';
import { MergeSnapshot } from '@modules/account-merge/interface/index.js';

@Injectable()
export class RedisService extends BaseRedisService {
  constructor(@Inject(REDIS_CLIENT_TOKEN) redisClient: Redis, configService: ConfigService) {
    const keyPrefix = configService.get<RedisConfig['keyPrefix']>('redis.keyPrefix') ?? '';
    super(redisClient, keyPrefix);
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
   * 계정 병합 확인 토큰 저장 (token → requestId 매핑)
   * @param token - UUID v4 토큰
   * @param requestId - 병합 요청 ID
   * @param ttl - TTL (기본값: 86400초 = 24시간)
   */
  async setAccountMergeToken(token: string, requestId: number, ttl = 86400): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.MERGE_TOKEN_PREFIX, token);
    await this.setExValue(key, ttl, String(requestId));
  }

  /**
   * 계정 병합 확인 토큰으로 requestId 조회
   * @param token - UUID v4 토큰
   * @returns 병합 요청 ID 또는 null
   */
  async getAccountMergeToken(token: string): Promise<number | null> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.MERGE_TOKEN_PREFIX, token);
    const requestId = await this.getValue(key);
    return requestId ? parseInt(requestId, 10) : null;
  }

  /**
   * 계정 병합 확인 토큰 삭제
   * @param token - UUID v4 토큰
   */
  async deleteAccountMergeToken(token: string): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.MERGE_TOKEN_PREFIX, token);
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

  // ==================== 계정 병합 스냅샷 관리 ====================

  /**
   * 계정 병합 스냅샷 저장
   * @param requestId - 병합 요청 ID
   * @param snapshot - 스냅샷 데이터
   * @param ttl - TTL (기본값: 604800초 = 7일)
   */
  async setMergeSnapshot(requestId: number, snapshot: MergeSnapshot, ttl = 604800): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.MERGE_SNAPSHOT_PREFIX, requestId);
    await this.setExValue(key, ttl, JSON.stringify(snapshot));
  }

  /**
   * 계정 병합 스냅샷 조회
   * @param requestId - 병합 요청 ID
   * @returns 스냅샷 데이터 또는 null
   */
  async getMergeSnapshot(requestId: number): Promise<MergeSnapshot | null> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.MERGE_SNAPSHOT_PREFIX, requestId);
    const data = await this.getValue(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 계정 병합 스냅샷 삭제
   * @param requestId - 병합 요청 ID
   */
  async deleteMergeSnapshot(requestId: number): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.AUTH.MERGE_SNAPSHOT_PREFIX, requestId);
    await this.deleteValue(key);
  }

  // ==================== 사용자 권한 캐시 관리 ====================

  /**
   * 사용자 권한 캐시 삭제
   * @param userId - 사용자 ID
   */
  async deleteUserPermissionCache(userId: string): Promise<void> {
    const key = this.buildKey(REDIS_BASE_KEYS.CACHE.USER_PERMISSION_PREFIX, userId);
    await this.deleteValue(key);
  }
}
