/**
 * Redis 키 베이스 상수
 *
 * 이 상수들은 환경변수와 결합되어 실제 Redis 키를 생성합니다.
 * - NAME: 키 명칭 (그 자체가 완전한 키)
 * - PREFIX: 키 접두사 (뒤에 ID가 붙음)
 */

export const REDIS_BASE_KEYS = {
  /**
   * JWT 관련 Redis 키
   */
  JWT: {
    /** JWT Refresh Token 저장소 명칭 (쿠키 스토어) */
    REFRESH_NAME: 'refreshToken',

    /** JWT 블랙리스트 접두사 (만료된 토큰 저장) */
    BLACKLIST_PREFIX: 'blacklist',

    /** Naver OAuth State 접두사 */
    NAVER_STATE_PREFIX: 'naverState',

    /** Google OAuth State 접두사 */
    GOOGLE_STATE_PREFIX: 'googleState',
  },

  /**
   * OAuth 관련 Redis 키
   */
  OAUTH: {
    /** OAuth 리다이렉트 세션 접두사 */
    REDIRECT_SESSION_PREFIX: 'redirectSession',
  },

  /**
   * 인증 관련 Redis 키
   */
  AUTH: {
    /** 비밀번호 재설정 토큰 접두사 */
    PASSWORD_RESET_PREFIX: 'passwordReset',

    /** 계정 병합 확인 토큰 접두사 */
    MERGE_TOKEN_PREFIX: 'merge:token',

    /** 계정 병합 스냅샷 접두사 */
    MERGE_SNAPSHOT_PREFIX: 'merge:snapshot',

    /** 이메일 인증 토큰 접두사 */
    EMAIL_VERIFICATION_PREFIX: 'emailVerify',
  },

  /**
   * 캐시 관련 Redis 키
   */
  CACHE: {
    /** 사용자 권한 캐시 접두사 */
    USER_PERMISSION_PREFIX: 'user:permissions',
  },
} as const;

/**
 * Redis 키 타입
 */
export type RedisBaseKeys = typeof REDIS_BASE_KEYS;
