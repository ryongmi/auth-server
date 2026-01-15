/**
 * 계정 병합 관련 상수 정의
 *
 * 시간, 타임아웃, 재시도 정책 등 모든 매직 넘버를 중앙 집중 관리
 */

// ============================================================================
// 시간 단위 변환 상수
// ============================================================================

/** 1시간을 밀리초로 변환 */
export const MS_PER_HOUR = 1000 * 60 * 60;

/** 1시간을 초로 변환 */
export const SECONDS_PER_HOUR = 60 * 60;

/** 1일을 시간으로 변환 */
export const HOURS_PER_DAY = 24;

// ============================================================================
// 병합 요청 만료 시간
// ============================================================================

/** 병합 요청 만료 시간 (시간 단위) */
export const MERGE_REQUEST_EXPIRATION_HOURS = 24;

/** 병합 요청 만료 시간 (초 단위) - Redis TTL용 */
export const MERGE_REQUEST_EXPIRATION_SECONDS = MERGE_REQUEST_EXPIRATION_HOURS * SECONDS_PER_HOUR;

/** 병합 요청 만료 시간 (밀리초 단위) - Date 계산용 */
export const MERGE_REQUEST_EXPIRATION_MS = MERGE_REQUEST_EXPIRATION_HOURS * MS_PER_HOUR;

// ============================================================================
// 스냅샷 저장 기간
// ============================================================================

/** 병합 스냅샷 보관 기간 (일 단위) */
export const SNAPSHOT_RETENTION_DAYS = 7;

/** 병합 스냅샷 보관 기간 (초 단위) - Redis TTL용 */
export const SNAPSHOT_RETENTION_SECONDS = SNAPSHOT_RETENTION_DAYS * HOURS_PER_DAY * SECONDS_PER_HOUR;

// ============================================================================
// TCP 타임아웃
// ============================================================================

/** 기본 TCP 타임아웃 (밀리초) */
export const DEFAULT_TCP_TIMEOUT_MS = 5000;

/** my-pick 서비스 TCP 타임아웃 (밀리초) - 여러 테이블 처리로 더 긴 시간 필요 */
export const MYPICK_TCP_TIMEOUT_MS = 10000;

// ============================================================================
// Saga 재시도 정책
// ============================================================================

/** 기본 최대 재시도 횟수 */
export const DEFAULT_MAX_RETRIES = 3;

/** 캐시 무효화 최대 재시도 횟수 */
export const CACHE_MAX_RETRIES = 1;

/** 재시도 기본 지연 시간 (밀리초) */
export const RETRY_BASE_DELAY_MS = 1000;

/** 재시도 최대 지연 시간 (밀리초) */
export const RETRY_MAX_DELAY_MS = 5000;
