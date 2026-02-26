# OAuth 계정 병합 구현 계획

## 문제 정의

User A가 이미 User B에게 속한 OAuth 계정(Google/Naver)을 연동하려고 할 때, 시스템은 다음을 수행해야 합니다:
1. User B의 이메일로 확인 메일 발송
2. 확인 후, User B의 데이터를 User A로 병합
3. 3개의 분리된 데이터베이스를 가진 마이크로서비스 간 데이터 무결성을 유지하면서 User B 삭제

**과제**: 분산 트랜잭션(2PC)이 불가능한 3개의 분리된 MySQL 데이터베이스(auth-server, authz-server, my-pick-server)를 가진 MSA 환경

**해결책**: 보상 트랜잭션을 통한 롤백 기능을 갖춘 Saga 오케스트레이션 패턴

## 아키텍처 개요

### Saga 오케스트레이터 설계
- **위치**: `auth-server/src/modules/oauth/account-merge.orchestrator.ts`
- **베이스 클래스**: `@krgeobuk/saga` 패키지의 `BaseSagaOrchestrator` 상속
- **패턴**: 오케스트레이션 기반 Saga (중앙 집중식 제어)
- **실행 방식**: 동기식 (1초 이내 완료 예상)
- **재시도**: 오류 분류를 통한 스마트 재시도 (일시적 vs 영구적)
- **재시도 설정**: Exponential backoff로 3회 시도 (1초, 3초, 5초 지연)
- **롤백**: 역순으로 보상 트랜잭션 실행
- **성공률**: 99.8% (재시도 없을 때 95%)
- **재사용성**: 향후 사용을 위해 공유 패키지에 범용 재시도 및 Saga 유틸리티 제공

### 데이터 일관성 전략
- **User A 우선순위**: User A의 데이터 유지; User B의 중복 데이터 폐기
- **UNIQUE 제약조건**: `user_subscriptions(userId, creatorId)` 및 `user_interactions(userId, contentId)`의 충돌 처리
- **감사 추적**: User B 소프트 삭제; `deletedAt` 필드에 보존

### 공유 패키지 아키텍처

**공통 패키지 분리 전략**: 재사용 가능한 Saga 패턴 유틸리티를 `@krgeobuk/saga` 공유 패키지로 추출하여 다른 서비스에서도 활용할 수 있도록 설계합니다.

#### @krgeobuk/saga 패키지 구조

```
shared-lib/packages/saga/
├── package.json
├── src/
│   ├── retry/
│   │   ├── retry.util.ts              # 스마트 재시도 로직
│   │   ├── error-classifier.ts        # 오류 분류 (일시적/영구적)
│   │   └── retry-options.interface.ts # 재시도 설정 인터페이스
│   ├── orchestrator/
│   │   ├── base-saga-orchestrator.ts  # 추상 Saga 오케스트레이터
│   │   ├── saga-step.interface.ts     # Step 인터페이스
│   │   └── saga-context.interface.ts  # 실행 컨텍스트
│   └── index.ts
└── tsconfig.json
```

#### 역할 분리

**공통 패키지 (@krgeobuk/saga)** - 범용 유틸리티:
- `RetryUtil`: 스마트 재시도 로직 (exponential backoff)
- `ErrorClassifier`: 오류 분류 (ETIMEDOUT, Lock wait timeout 등)
- `BaseSagaOrchestrator`: Saga 패턴 추상 베이스 클래스
- `SagaStep`: 단계 실행 인터페이스

**auth-server** - 도메인 특화 구현:
- `AccountMergeOrchestrator`: 계정 병합 전용 오케스트레이터
- OAuth 계정 이전, 역할 병합, 사용자 삭제 등 비즈니스 로직
- 보상 트랜잭션 구현

#### 재사용 시나리오

다른 서비스에서 동일한 Saga 패턴 활용 예시:
```typescript
// my-pick-server에서 크리에이터 병합 시
class CreatorMergeOrchestrator extends BaseSagaOrchestrator<...> {
  // @krgeobuk/saga의 retry, error classification 재사용
}

// authz-server에서 역할 병합 시
class RoleMergeOrchestrator extends BaseSagaOrchestrator<...> {
  // 동일한 패턴 적용
}
```

## 업데이트할 테이블 (총 8개)

### auth-server (1개 테이블)
- `oauth_account` - OAuth 연결을 User B에서 User A로 이전

### authz-server (1개 테이블)
- `user_role` - 역할 이전, User A가 이미 가지고 있으면 건너뛰기

### my-pick-server (6개 테이블)
- `creators` - 크리에이터 소유권 업데이트
- `user_subscriptions` - 구독 병합, UNIQUE(userId, creatorId) 처리
- `user_interactions` - 상호작용 병합, UNIQUE(userId, contentId) 처리
- `creator_registrations` - 신청자 업데이트
- `reports` - 신고자 업데이트
- `content_moderation` - 검토자 업데이트
- `report_review` - 리뷰어 업데이트

## 구현 흐름

### 1단계: 이메일 인증 (24시간 유효)

**Step 1**: User A가 OAuth 계정 연동 요청 → 시스템이 User B에 속한 것을 감지
**Step 2**: `PENDING_EMAIL_VERIFICATION` 상태로 병합 요청 레코드 생성
**Step 3**: `crypto.randomUUID()`로 암호화 토큰 생성 → Redis에 저장 (24시간 TTL)
**Step 4**: User B의 이메일 주소로 확인 메일 발송
**Step 5**: User B가 링크 클릭 → 토큰 검증 → 상태가 `EMAIL_VERIFIED`로 변경

### 2단계: Saga 실행

**오케스트레이터 단계**:
1. **auth-server**: User B 스냅샷을 Redis에 백업 (7일 TTL) → `oauth_account.userId` 업데이트
2. **authz-server**: TCP 엔드포인트 `user-role.mergeUsers` 호출 → 트랜잭션으로 역할 이전
3. **my-pick-server**: TCP 엔드포인트 `user.mergeAccounts` 호출 → 단일 트랜잭션으로 6개 테이블 업데이트
4. **auth-server**: User B 소프트 삭제 → `deletedAt = NOW()` 설정
5. **Redis**: User B의 권한 캐시 무효화

**성공 시**: 상태 → `COMPLETED` (전체 흐름 < 1초)
**실패 시**: 역순으로 보상 트랜잭션 실행

### 3단계: 보상 트랜잭션 (롤백)

**트리거 조건**:
- 서비스 사용 불가 (5초 후 TCP 타임아웃)
- 데이터베이스 락 타임아웃
- 네트워크 장애

**롤백 단계** (역순):
1. Redis 스냅샷에서 User B 복원 → `deletedAt = NULL` 설정
2. `user.rollbackMerge` TCP 엔드포인트를 통해 my-pick-server 변경 사항 되돌리기
3. `user-role.rollbackMerge` TCP 엔드포인트를 통해 authz-server 변경 사항 되돌리기
4. auth-server OAuth 계정 변경 사항 되돌리기
5. 상태 → `FAILED` 또는 `COMPENSATED`

**안전성**: 각 단계는 멱등성; 부작용 없이 안전하게 재시도 가능

## 데이터베이스 스키마

### 신규 테이블: account_merge_request

```typescript
@Entity('account_merge_request')
export class AccountMergeRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, comment: 'User A (유지할 계정)' })
  targetUserId: string;

  @Column({ type: 'varchar', length: 36, comment: 'User B (삭제될 계정)' })
  sourceUserId: string;

  @Column({ type: 'enum', enum: OAuthAccountProviderType })
  provider: OAuthAccountProviderType;

  @Column({ type: 'varchar', length: 255, comment: 'OAuth providerId' })
  providerId: string;

  @Column({
    type: 'enum',
    enum: AccountMergeStatus,
    default: AccountMergeStatus.PENDING_EMAIL_VERIFICATION,
  })
  status: AccountMergeStatus;

  @Column({ type: 'text', nullable: true, comment: '실패 시 오류 상세 정보' })
  errorMessage: string | null;

  @Column({ type: 'int', default: 0, comment: '현재 재시도 횟수' })
  retryCount: number;

  @Column({ type: 'datetime', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'datetime' })
  createdAt: Date;

  @Column({ type: 'datetime' })
  updatedAt: Date;
}
```

### Enum: AccountMergeStatus

```typescript
export enum AccountMergeStatus {
  PENDING_EMAIL_VERIFICATION = 'PENDING_EMAIL_VERIFICATION', // 이메일 인증 대기
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',                         // 이메일 인증 완료
  IN_PROGRESS = 'IN_PROGRESS',                               // 병합 진행 중
  STEP1_AUTH_BACKUP = 'STEP1_AUTH_BACKUP',                   // 1단계: 백업 완료
  STEP2_AUTHZ_MERGE = 'STEP2_AUTHZ_MERGE',                   // 2단계: 역할 병합
  STEP3_MYPICK_MERGE = 'STEP3_MYPICK_MERGE',                 // 3단계: 데이터 병합
  STEP4_USER_DELETE = 'STEP4_USER_DELETE',                   // 4단계: 사용자 삭제
  STEP5_CACHE_INVALIDATE = 'STEP5_CACHE_INVALIDATE',         // 5단계: 캐시 무효화
  COMPLETED = 'COMPLETED',                                    // 완료
  FAILED = 'FAILED',                                          // 실패
  COMPENSATING = 'COMPENSATING',                              // 보상 중
  COMPENSATED = 'COMPENSATED',                                // 보상 완료
  CANCELLED = 'CANCELLED',                                    // 취소됨
}
```

## API 엔드포인트

### 1. 계정 병합 요청
```typescript
POST /oauth/account-merge/request
Authorization: Bearer {accessToken}

요청 본문:
{
  provider: 'GOOGLE' | 'NAVER',
  providerId: string
}

응답:
{
  success: true,
  data: {
    mergeRequestId: string,
    targetUserId: string,      // User A
    sourceUserEmail: string,   // User B의 이메일
    expiresAt: string          // 현재로부터 24시간 후
  }
}

오류 코드:
- OAUTH_210: 병합 요청 생성 실패
- OAUTH_211: 이메일 발송 실패
```

### 2. 이메일 링크를 통한 병합 확인
```typescript
GET /oauth/account-merge/confirm?token={uuid}

응답:
{
  success: true,
  data: {
    mergeRequestId: string,
    status: 'COMPLETED' | 'FAILED',
    completedAt: string | null,
    errorMessage: string | null
  }
}

오류 코드:
- OAUTH_212: 유효하지 않거나 만료된 토큰
- OAUTH_213: 병합 실행 실패
```

### 3. 병합 상태 조회
```typescript
GET /oauth/account-merge/status/:mergeRequestId
Authorization: Bearer {accessToken}

응답:
{
  success: true,
  data: {
    id: string,
    status: AccountMergeStatus,
    retryCount: number,
    errorMessage: string | null,
    createdAt: string,
    completedAt: string | null
  }
}
```

### 4. 병합 요청 취소
```typescript
DELETE /oauth/account-merge/:mergeRequestId
Authorization: Bearer {accessToken}

응답:
{
  success: true,
  message: '병합 요청이 취소되었습니다'
}

오류 코드:
- OAUTH_214: 취소 불가 (이미 진행 중)
- OAUTH_215: 병합 요청을 찾을 수 없음
```

## 서비스 통합

### auth-server TCP 엔드포인트 (내부 - 새 엔드포인트 불필요)
- 트랜잭션 관리자 파라미터와 함께 기존 메서드 사용

### authz-server TCP 엔드포인트 (신규)
```typescript
@Controller()
export class UserRoleTcpController {
  @MessagePattern('user-role.mergeUsers')
  async mergeUsers(@Payload() data: { targetUserId: string; sourceUserId: string }) {
    // source에서 target으로 역할 이전
    // target이 이미 역할을 가지고 있으면 건너뛰기
    // { success: true, transferredRoles: number } 반환
  }

  @MessagePattern('user-role.rollbackMerge')
  async rollbackMerge(@Payload() data: { snapshotData: any }) {
    // 스냅샷에서 복원
    // { success: true } 반환
  }
}
```

### my-pick-server TCP 엔드포인트 (신규)
```typescript
@Controller()
export class UserMergeTcpController {
  @MessagePattern('user.mergeAccounts')
  async mergeAccounts(@Payload() data: { targetUserId: string; sourceUserId: string }) {
    // 단일 트랜잭션으로 6개 테이블 업데이트
    // UNIQUE 제약조건 충돌 처리 (User A 데이터 유지)
    // { success: true, stats: { creators: 2, subscriptions: 5, ... } } 반환
  }

  @MessagePattern('user.rollbackMerge')
  async rollbackMerge(@Payload() data: { snapshotData: any }) {
    // 스냅샷에서 복원
    // { success: true } 반환
  }
}
```

## Redis 저장 구조

### 병합 토큰
```
키: merge:token:{uuid}
값: { mergeRequestId, sourceUserId, targetUserId }
TTL: 24시간 (86400초)
```

### 사용자 스냅샷 백업
```
키: merge:snapshot:{mergeRequestId}
값: {
  user: UserEntity,
  oauthAccounts: OAuthAccountEntity[],
  roles: UserRoleEntity[],
  myPickData: { creators, subscriptions, interactions, ... }
}
TTL: 7일 (604800초)
```

## 오류 처리

### 신규 오류 코드 (@krgeobuk/oauth 패키지)
```typescript
OAUTH_210: '계정 병합 요청 생성 실패'
OAUTH_211: '확인 이메일 발송 실패'
OAUTH_212: '유효하지 않거나 만료된 병합 확인 토큰'
OAUTH_213: '계정 병합 실행 실패'
OAUTH_214: '현재 상태에서 병합 요청 취소 불가'
OAUTH_215: '병합 요청을 찾을 수 없음'
```

### 스마트 재시도 전략

**접근 방식**: 영구적 오류로 인한 시간 낭비를 피하기 위해 오류를 재시도 가능(일시적)과 재시도 불가능(영구적)으로 분류합니다.

#### 오류 분류

**재시도 가능한 오류 (일시적)**:
```typescript
enum RetryableErrorType {
  NETWORK_TIMEOUT = 'ETIMEDOUT',           // 네트워크 타임아웃
  CONNECTION_REFUSED = 'ECONNREFUSED',     // 서비스 재시작 중
  CONNECTION_RESET = 'ECONNRESET',         // 연결 리셋
  DB_LOCK_TIMEOUT = 'Lock wait timeout',   // DB 락 대기 타임아웃
  SERVICE_UNAVAILABLE = 503,               // 서비스 일시 과부하
  TOO_MANY_REQUESTS = 429,                 // Rate limit (재시도 가능)
}
```

**재시도 불가능한 오류 (영구적)**:
```typescript
enum PermanentErrorType {
  UNIQUE_CONSTRAINT = 'ER_DUP_ENTRY',      // UNIQUE 제약 위반
  FOREIGN_KEY_CONSTRAINT = 'ER_NO_REFERENCED_ROW', // FK 제약 위반
  INVALID_DATA = 'ER_DATA_TOO_LONG',       // 데이터 크기 초과
  UNAUTHORIZED = 401,                       // 권한 없음
  FORBIDDEN = 403,                          // 접근 거부
  NOT_FOUND = 404,                          // 리소스 없음
  BAD_REQUEST = 400,                        // 잘못된 요청
}
```

#### 재시도 설정

```typescript
interface RetryConfig {
  maxRetries: 3;                    // 최대 재시도 횟수
  backoffType: 'exponential';       // 백오프 전략
  baseDelayMs: 1000;                // 기본 지연 시간 (1초)
  maxDelayMs: 5000;                 // 최대 지연 시간 (5초)
  stepTimeoutMs: 5000;              // 각 단계별 타임아웃
}
```

**백오프 지연**:
- 1회 재시도: 1초 대기 (1000ms)
- 2회 재시도: 3초 대기 (3000ms)
- 3회 재시도: 5초 대기 (5000ms)

#### 구현 로직

```typescript
private async executeStepWithRetry<T>(
  stepName: string,
  stepFn: () => Promise<T>,
  mergeRequest: AccountMergeRequestEntity,
): Promise<T> {
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 단계 실행
      const result = await Promise.race([
        stepFn(),
        this.createTimeout(5000), // 5초 타임아웃
      ]);

      // 성공 시 재시도 횟수 리셋
      if (attempt > 1) {
        this.logger.log(
          `Step ${stepName} succeeded after ${attempt} attempts`,
        );
      }

      return result as T;
    } catch (error) {
      lastError = error;

      // 오류 분류
      const isRetryable = this.isRetryableError(error);
      const isLastAttempt = attempt === maxRetries;

      // 로깅
      this.logger.warn(
        `Step ${stepName} failed (attempt ${attempt}/${maxRetries}): ${error.message}`,
        { isRetryable, error },
      );

      // 영구적 오류이거나 마지막 시도인 경우
      if (!isRetryable || isLastAttempt) {
        // 재시도 횟수 기록
        await this.mergeRequestRepository.update(mergeRequest.id, {
          retryCount: attempt,
          errorMessage: error.message,
        });

        throw error; // 롤백 트리거
      }

      // 재시도 전 대기 (exponential backoff)
      const delayMs = Math.min(
        Math.pow(2, attempt - 1) * 1000, // 1s, 2s, 4s...
        5000, // 최대 5초
      );

      this.logger.log(`Retrying ${stepName} after ${delayMs}ms...`);
      await this.sleep(delayMs);

      // 재시도 횟수 기록
      await this.mergeRequestRepository.update(mergeRequest.id, {
        retryCount: attempt,
      });
    }
  }

  throw lastError;
}

private isRetryableError(error: any): boolean {
  // 네트워크 오류
  if (error.code === 'ETIMEDOUT') return true;
  if (error.code === 'ECONNREFUSED') return true;
  if (error.code === 'ECONNRESET') return true;
  if (error.code === 'EPIPE') return true;

  // DB 락 타임아웃
  if (error.message?.includes('Lock wait timeout')) return true;
  if (error.code === 'ER_LOCK_WAIT_TIMEOUT') return true;
  if (error.code === 'ER_LOCK_DEADLOCK') return true;

  // HTTP 상태 코드
  if (error.statusCode === 503) return true; // Service Unavailable
  if (error.statusCode === 504) return true; // Gateway Timeout
  if (error.statusCode === 429) return true; // Too Many Requests

  // TCP 마이크로서비스 오류
  if (error.name === 'TimeoutError') return true;
  if (error.message?.includes('timeout')) return true;

  // 기본값: 재시도 불가
  return false;
}

private createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timeout after ${ms}ms`)), ms),
  );
}

private sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

#### 예상 동작

**시나리오 1: 일시적 네트워크 지연**
```
시도 1: authz-server TCP 호출 → ETIMEDOUT (네트워크 지연)
대기 1초
시도 2: authz-server TCP 호출 → 성공 ✓
결과: 사용자는 약 1초 지연만 경험, 병합 성공
```

**시나리오 2: DB 락 경합**
```
시도 1: my-pick-server 업데이트 → Lock wait timeout (다른 트랜잭션 대기 중)
대기 1초
시도 2: my-pick-server 업데이트 → Lock wait timeout (여전히 락)
대기 3초
시도 3: my-pick-server 업데이트 → 성공 ✓ (락 해제됨)
결과: 총 4초 지연 후 성공
```

**시나리오 3: 영구적 오류 (빠른 실패)**
```
시도 1: user-role 이전 → UNIQUE constraint violation (이미 존재)
판단: 영구적 오류 → 재시도 불가
결과: 즉시 롤백 시작 (시간 낭비 없음)
```

**시나리오 4: 최대 재시도 초과**
```
시도 1: TCP 호출 → ECONNREFUSED
대기 1초
시도 2: TCP 호출 → ECONNREFUSED
대기 3초
시도 3: TCP 호출 → ECONNREFUSED
결과: 3회 실패 후 롤백 시작
```

#### 성능 영향

**정상 케이스 (재시도 없음)**:
- 실행 시간: ~1초
- 사용자 경험: 원활

**1회 재시도 케이스**:
- 실행 시간: ~2초 (1초 대기 + 1초 실행)
- 사용자 경험: 약간의 지연, 하지만 성공

**2회 재시도 케이스**:
- 실행 시간: ~5초 (1+3초 대기 + 1초 실행)
- 사용자 경험: 눈에 띄는 지연, 하지만 롤백보다 나음

**3회 재시도 케이스**:
- 실행 시간: ~10초 (1+3+5초 대기 + 1초 실행)
- 사용자 경험: 긴 대기, 하지만 최종 성공 가능

**영구 오류 케이스**:
- 실행 시간: ~1초 (재시도 없이 즉시 롤백)
- 사용자 경험: 빠른 실패 피드백

#### 성공률 개선

**재시도 없을 때**:
- 일시적 오류 발생률: ~5%
- 최종 성공률: 95%

**스마트 재시도 사용 시**:
- 1회 재시도 성공률: 80% (총 96% 성공)
- 2회 재시도 성공률: 15% (총 99% 성공)
- 3회 재시도 성공률: 4% (총 99.8% 성공)
- **최종 성공률: ~99.8%** (4% → 0.2% 실패율 감소)

## 코드 구현 예시

### 1. 공유 패키지: @krgeobuk/saga

#### RetryUtil (retry.util.ts)
```typescript
export class RetryUtil {
  static async executeWithRetry<T>(
    stepName: string,
    fn: () => Promise<T>,
    options: RetryOptions,
    onRetry?: (attempt: number, error: any) => Promise<void>,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          fn(),
          this.createTimeout(options.timeoutMs),
        ]);
        return result as T;
      } catch (error) {
        lastError = error;

        const isRetryable = ErrorClassifier.isRetryable(error);
        if (!isRetryable || attempt === options.maxRetries) {
          throw error;
        }

        const delayMs = this.calculateDelay(attempt, options);
        if (onRetry) await onRetry(attempt, error);
        await this.sleep(delayMs);
      }
    }
    throw lastError;
  }

  private static calculateDelay(attempt: number, options: RetryOptions): number {
    return Math.min(
      Math.pow(2, attempt - 1) * options.baseDelayMs,
      options.maxDelayMs,
    );
  }
}
```

#### BaseSagaOrchestrator (base-saga-orchestrator.ts)
```typescript
export abstract class BaseSagaOrchestrator<TRequest, TSnapshot> {
  protected abstract getSteps(): SagaStep<TRequest>[];
  protected abstract createSnapshot(request: TRequest): Promise<TSnapshot>;
  protected abstract compensate(
    completedSteps: string[],
    snapshot: TSnapshot,
  ): Promise<void>;

  async execute(request: TRequest): Promise<void> {
    const steps = this.getSteps();
    const snapshot = await this.createSnapshot(request);
    let completedSteps: string[] = [];

    try {
      for (const step of steps) {
        await RetryUtil.executeWithRetry(
          step.name,
          () => step.execute(request),
          step.retryOptions,
          step.onRetry,
        );
        completedSteps.push(step.name);
      }
    } catch (error) {
      await this.compensate(completedSteps.reverse(), snapshot);
      throw error;
    }
  }
}
```

### 2. Auth Server: AccountMergeOrchestrator

```typescript
import { BaseSagaOrchestrator, SagaStep, RetryOptions } from '@krgeobuk/saga';

@Injectable()
export class AccountMergeOrchestrator extends BaseSagaOrchestrator<
  AccountMergeRequestEntity,
  MergeSnapshot
> {
  constructor(
    private readonly oauthService: OAuthService,
    @Inject('AUTHZ_SERVICE') private readonly authzClient: ClientProxy,
    @Inject('MYPICK_SERVICE') private readonly myPickClient: ClientProxy,
  ) {
    super();
  }

  protected getSteps(): SagaStep<AccountMergeRequestEntity>[] {
    const defaultRetryOptions: RetryOptions = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      timeoutMs: 5000,
      backoffType: 'exponential',
    };

    return [
      {
        name: 'STEP1_AUTH_BACKUP',
        execute: (req) => this.backupAndMergeOAuth(req),
        retryOptions: defaultRetryOptions,
      },
      {
        name: 'STEP2_AUTHZ_MERGE',
        execute: (req) => this.mergeRoles(req),
        retryOptions: defaultRetryOptions,
      },
      // ... 나머지 단계
    ];
  }

  protected async createSnapshot(
    request: AccountMergeRequestEntity,
  ): Promise<MergeSnapshot> {
    // User B 데이터를 Redis에 백업
    const snapshot = {
      sourceUser: await this.userService.findOne(request.sourceUserId),
      sourceOAuthAccounts: await this.oauthService.findByUserId(request.sourceUserId),
      // ...
    };

    await this.redisService.setExValue(
      `merge:snapshot:${request.id}`,
      JSON.stringify(snapshot),
      604800, // 7일
    );

    return snapshot;
  }

  protected async compensate(
    completedSteps: string[],
    snapshot: MergeSnapshot,
  ): Promise<void> {
    // 역순으로 보상 트랜잭션 실행
    for (const stepName of completedSteps) {
      switch (stepName) {
        case 'STEP4_USER_DELETE':
          await this.restoreUser(snapshot);
          break;
        case 'STEP3_MYPICK_MERGE':
          await this.rollbackMyPickMerge(snapshot);
          break;
        // ...
      }
    }
  }

  private async mergeRoles(request: AccountMergeRequestEntity): Promise<void> {
    // @krgeobuk/saga의 재시도 로직이 자동으로 적용됨
    const result = await this.authzClient
      .send('user-role.mergeUsers', {
        targetUserId: request.targetUserId,
        sourceUserId: request.sourceUserId,
      })
      .toPromise();
  }
}
```

## 관리자 복구

- 수동 롤백 엔드포인트: `POST /admin/account-merge/:id/rollback`
- 스냅샷에서 복원: `POST /admin/account-merge/:id/restore`
- 수동 개입이 필요한 실패한 보상에 대한 알림 시스템

## 보안 고려사항

### 권한 부여
- User A만 병합 요청 가능 (JWT로 검증)
- 토큰은 일회용; 확인 후 삭제
- 토큰 엔트로피를 통한 CSRF 보호 (UUID v4)

### Rate Limiting
- 사용자당 시간당 최대 3개의 병합 요청
- 토큰당 최대 5회의 확인 시도

### 감사 추적
- 상태 전환과 함께 모든 병합 시도 DB에 기록
- 조사를 위해 7일간 스냅샷 백업 보관
- User B 소프트 삭제 (감사 추적 보존)

## 캐시 무효화 전략

### 무효화할 Redis 키
```typescript
// User B의 권한 캐시
await this.redisService.deleteValue(`user:${sourceUserId}:permissions`);

// User A의 권한 캐시 (병합 후 갱신)
await this.redisService.deleteValue(`user:${targetUserId}:permissions`);
```

## 테스트 전략

### 단위 테스트
- AccountMergeOrchestrator: 각 단계 및 보상 테스트
- 서비스 병합 메서드: UNIQUE 제약조건 처리 테스트
- Redis 토큰 검증: 만료 및 일회용 테스트

### 통합 테스트
- 전체 Saga 흐름: 이메일 → 확인 → 병합 → 성공
- 실패 시나리오: TCP 타임아웃 → 롤백 → 보상됨
- 중복 데이터: User A & B 모두 동일한 크리에이터 구독 → A의 것 유지

### E2E 테스트
- 테스트 SMTP를 통한 실제 이메일 전송
- 다중 서비스 트랜잭션 조정
- 성능: 정상 케이스에서 1초 이내 완료 검증

## 5단계 구현 일정

### 1단계: 기반 작업 및 공유 패키지 (1주차)

#### 1-1. 공유 패키지: @krgeobuk/saga
**생성할 파일**:
- `shared-lib/packages/saga/package.json`
- `shared-lib/packages/saga/tsconfig.json`
- `shared-lib/packages/saga/src/retry/retry.util.ts`
- `shared-lib/packages/saga/src/retry/error-classifier.ts`
- `shared-lib/packages/saga/src/retry/retry-options.interface.ts`
- `shared-lib/packages/saga/src/orchestrator/base-saga-orchestrator.ts`
- `shared-lib/packages/saga/src/orchestrator/saga-step.interface.ts`
- `shared-lib/packages/saga/src/orchestrator/saga-context.interface.ts`
- `shared-lib/packages/saga/src/index.ts`

**작업**:
- 스마트 재시도 유틸리티 구현 (RetryUtil)
- 오류 분류기 구현 (ErrorClassifier)
- 추상 Saga 오케스트레이터 베이스 클래스
- TypeScript 설정 및 빌드 스크립트
- Verdaccio에 패키지 게시

#### 1-2. Auth Server 기반
**생성할 파일**:
- `auth-server/src/modules/oauth/entities/account-merge-request.entity.ts`
- `auth-server/src/database/migrations/{timestamp}-create-account-merge-request.ts`
- `shared-lib/packages/oauth/src/error-codes/oauth-error.code.ts` (OAUTH_210-215 추가)
- `shared-lib/packages/oauth/src/enums/account-merge-status.enum.ts`

**수정할 파일**:
- `auth-server/src/database/redis/redis.service.ts` - 토큰 저장 메서드 추가
- `auth-server/src/modules/email/templates/` - 병합 확인 템플릿 추가
- `auth-server/package.json` - `@krgeobuk/saga` 의존성 추가

**작업**:
- 데이터베이스 스키마 설계 및 마이그레이션
- 오류 코드 정의
- Redis 저장 메서드
- 이메일 템플릿 생성
- @krgeobuk/saga 패키지 설치

### 2단계: 오케스트레이터 핵심 (2주차)
**생성할 파일**:
- `auth-server/src/modules/oauth/account-merge.orchestrator.ts` - `BaseSagaOrchestrator` 상속
- `auth-server/src/modules/oauth/dto/merge-request.dto.ts`
- `auth-server/src/modules/oauth/interfaces/merge-snapshot.interface.ts`

**수정할 파일**:
- `auth-server/src/modules/oauth/oauth.service.ts:368-372` - 오류 발생을 병합 요청 생성으로 대체

**작업**:
- **AccountMergeOrchestrator 구현**:
  - `BaseSagaOrchestrator<AccountMergeRequestEntity, MergeSnapshot>` 상속
  - `@krgeobuk/saga`의 `RetryUtil`, `ErrorClassifier` 활용
  - 5단계 Saga Step 정의 (getSteps 메서드)
- **스냅샷 관리**:
  - createSnapshot: User B 데이터를 Redis에 백업
  - restoreSnapshot: 롤백 시 복원
- **보상 트랜잭션**:
  - compensate 메서드 구현 (역순 실행)
  - 각 단계별 rollback 로직
- **상태 추적**:
  - AccountMergeStatus enum 활용
  - 재시도 횟수 DB 기록
- **스마트 재시도**: `@krgeobuk/saga`의 재시도 로직 활용 (추가 구현 불필요)

### 3단계: 서비스 병합 로직 (3주차)
**생성할 파일**:
- `authz-server/src/modules/user-role/user-role-tcp.controller.ts`
- `my-pick-server/src/modules/user/user-merge.service.ts`
- `my-pick-server/src/modules/user/user-merge-tcp.controller.ts`

**수정할 파일**:
- `authz-server/src/modules/user-role/user-role.service.ts` - mergeUsers() 메서드 추가
- `auth-server/src/modules/oauth/oauth.service.ts` - mergeOAuthAccounts() 메서드 추가
- `auth-server/src/modules/user/user.service.ts` - softDeleteUser() 메서드 추가

**작업**:
- auth-server: OAuth 계정 이전 로직
- authz-server: 중복 처리와 함께 역할 이전
- my-pick-server: UNIQUE 제약조건 처리와 함께 6개 테이블 병합
- 서비스별 트랜잭션 관리

### 4단계: 보상 로직 (4주차)
**수정할 파일**:
- `auth-server/src/modules/oauth/account-merge.orchestrator.ts` - 롤백 메서드 추가
- `authz-server/src/modules/user-role/user-role-tcp.controller.ts` - rollbackMerge 엔드포인트 추가
- `my-pick-server/src/modules/user/user-merge-tcp.controller.ts` - rollbackMerge 엔드포인트 추가

**작업**:
- 각 서비스에 대한 보상 트랜잭션
- 스냅샷 복원 로직
- 관리자 복구 엔드포인트
- 실패한 보상에 대한 알림

### 5단계: API 및 통합 (5주차)
**생성할 파일**:
- `auth-server/src/modules/oauth/oauth-merge.controller.ts`
- `auth-server/src/modules/oauth/test/account-merge.e2e-spec.ts`

**수정할 파일**:
- `auth-server/src/modules/oauth/oauth.module.ts` - 새 컨트롤러 및 오케스트레이터 등록

**작업**:
- HTTP 엔드포인트 (요청, 확인, 상태, 취소)
- Swagger 문서화
- E2E 통합 테스트
- 성능 테스트 및 최적화
- 보안 검토 (CSRF, rate limiting)

## 중요 파일 참조

### 검토할 기존 파일
1. `auth-server/src/modules/oauth/oauth.service.ts:358-402` - linkOAuthAccount 메서드
2. `auth-server/src/modules/user/user.repository.ts` - 사용자 쿼리 패턴
3. `authz-server/src/modules/user-role/user-role.service.ts` - 역할 관리
4. `auth-server/src/database/redis/redis.service.ts` - Redis 작업

### 설정 파일
1. `auth-server/envs/local.env` - rate limit 설정 추가
2. `authz-server/src/main.ts` - TCP 마이크로서비스 등록
3. `my-pick-server/src/main.ts` - TCP 마이크로서비스 등록

## 예상 성능

### 정상 케이스 (재시도 없음)
- **이메일 발송**: < 100ms
- **토큰 검증**: < 10ms (Redis 조회)
- **Saga 실행**: < 1초 (3개 서비스 호출)
- **총 사용자 대기 시간**: 이메일 클릭부터 완료까지 ~1-2초

### 스마트 재시도 사용 시
- **1회 재시도 케이스**: ~2초 (1초 대기 + 재실행)
- **2회 재시도 케이스**: ~5초 (1+3초 대기 + 재실행)
- **3회 재시도 케이스**: ~10초 (1+3+5초 대기 + 재실행)
- **영구 오류 케이스**: ~1초 (즉시 롤백, 재시도 없음)

### 성공률
- **재시도 없을 때**: 95% 성공률
- **스마트 재시도 사용**: 99.8% 성공률 (4.8% 향상)

### 롤백 성능
- **롤백 실행**: < 500ms (스냅샷 복원)
- **롤백 성공률**: 목표 100%

## 배포 전략

1. **1-4주차**: 기능 브랜치에서 개발
2. **5주차**: 합성 데이터로 스테이징 환경 테스트
3. **6주차**: 기능 플래그 비활성화 상태로 프로덕션 배포
4. **7주차**: 선정된 10명의 사용자와 베타 테스트
5. **8주차**: 모니터링과 함께 전체 배포

## 성공 지표

- **병합 성공률**: 목표 99.8% (스마트 재시도 사용)
  - 재시도 없음 95% → 스마트 재시도 99.8% (4.8% 개선)
- **롤백 성공률**: 목표 100%
- **이메일 전송률**: 목표 > 95%
- **평균 완료 시간**:
  - 정상 케이스: < 1초 (재시도 불필요)
  - 1회 재시도: ~2초
  - 2회 재시도: ~5초
  - 3회 재시도: ~10초
- **재시도 분포** (예상):
  - 재시도 불필요: 95%의 케이스
  - 1회 재시도: 4%의 케이스
  - 2회 재시도: 0.75%의 케이스
  - 3회 재시도: 0.2%의 케이스
  - 영구 실패: 0.05%의 케이스
- **데이터 손실 제로**: 스냅샷 감사 추적을 통해 검증
