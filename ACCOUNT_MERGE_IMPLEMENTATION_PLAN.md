# OAuth 계정 병합 기능 구현 계획 (프로젝트 맞춤형)

> 📅 작성일: 2026-01-03
> 📋 기반 문서: ACCOUNT_MERGE_PLAN.md
> 🎯 목적: 현재 krgeobuk 프로젝트 상태에 맞춘 실행 가능한 구현 계획
> ✅ **승인 완료**: 2026-01-03

## ✅ 승인된 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| **reports/report_review 처리** | 병합 대상 제외 | modules_backup 디렉토리, 현재 미사용 |
| **my-pick-server TCP 포트** | **8310** | 일관된 패턴 유지 (auth: 8010, authz: 8110) |
| **구현 방식** | **단계별 순차 구현** | 리스크 분산, 조기 피드백 |

**병합 대상 테이블**: 5개 (creators, user_subscriptions, user_interactions, creator_registrations, content_moderation)

---

## 📊 목차

1. [프로젝트 현황 요약](#1-프로젝트-현황-요약)
2. [핵심 변경 사항](#2-핵심-변경-사항)
3. [5단계 구현 계획](#3-5단계-구현-계획)
4. [질문 및 결정 필요사항](#4-질문-및-결정-필요사항)
5. [예상 일정 및 리소스](#5-예상-일정-및-리소스)
6. [핵심 리스크 및 완화 전략](#6-핵심-리스크-및-완화-전략)
7. [다음 단계](#7-다음-단계)

---

## 1. 프로젝트 현황 요약

### ✅ 준비된 인프라 (즉시 사용 가능)

#### 1.1 Email 서비스 (@krgeobuk/email)
- **상태**: ✅ 완전히 구현됨
- **위치**: `shared-lib/packages/email`
- **기능**:
  - Nodemailer 기반 SMTP 발송
  - Handlebars 템플릿 시스템
  - 기존 템플릿: `verification.hbs`, `password-reset.hbs`
  - Redis 토큰 관리 통합
- **필요 작업**: `account-merge.hbs` 템플릿 추가만 필요

#### 1.2 Redis 서비스
- **상태**: ✅ 완전히 구현됨
- **위치**: `auth-server/src/database/redis/redis.service.ts`
- **기능**:
  - `setExValue()` - TTL 지원 토큰 저장
  - OAuth state, password reset 패턴 존재
  - 24시간 토큰 만료 지원
- **필요 작업**: 병합 토큰 저장 메서드 추가

#### 1.3 OAuth 서비스
- **상태**: ✅ 트랜잭션 지원 완료
- **위치**: `auth-server/src/modules/oauth/oauth.service.ts`
- **현재 동작**:
  - `linkOAuthAccount` 메서드 (358-402줄)
  - 충돌 감지 시 `OAuthException.alreadyLinkedToAnotherAccount()` 발생
- **필요 작업**: 예외 발생 → 병합 요청 생성으로 변경

#### 1.4 TCP 인프라
- **상태**: ✅ 성숙한 패턴 확립
- **authz-server**: 6개 TCP 컨트롤러 운영 중
  - UserRoleTcpController, AuthorizationTcpController 등
  - 패턴: `@krgeobuk/{domain}/tcp/patterns`
- **공유 패턴**:
  - `@krgeobuk/msa-commons/clients/TcpClientBase` - 재시도 로직
  - `@krgeobuk/msa-commons/strategies/TcpFallbackStrategy` - 보상 패턴
- **필요 작업**: 병합 전용 TCP 엔드포인트 추가

#### 1.5 my-pick-server 데이터베이스
- **상태**: ✅ 5개 테이블 병합 대상 (reports/report_review 제외)

| 테이블 | 상태 | 위치 | 복잡도 | 병합 여부 |
|--------|------|------|--------|----------|
| `creators` | ACTIVE | modules/creator | LOW | ✅ **병합** |
| `user_subscriptions` | ACTIVE | modules/user-subscription | **CRITICAL** | ✅ **병합** |
| `user_interactions` | ACTIVE | modules/user-interaction | **CRITICAL** | ✅ **병합** |
| `creator_registrations` | ACTIVE | modules/creator-registration | LOW | ✅ **병합** |
| `content_moderation` | ACTIVE | modules/content | MINIMAL | ✅ **병합** |
| ~~`reports`~~ | BACKUP | modules_backup/report | ~~LOW~~ | ❌ **제외** |
| ~~`report_review`~~ | BACKUP | modules_backup/report | ~~MINIMAL~~ | ❌ **제외** |

---

### ❌ 신규 구현 필요 (현재 존재하지 않음)

#### 1.1 @krgeobuk/saga 패키지
- **상태**: ❌ 완전 신규
- **위치**: `shared-lib/packages/saga` (생성 필요)
- **구성요소**:
  - `RetryUtil` - 스마트 재시도 로직
  - `ErrorClassifier` - 일시적/영구적 오류 분류
  - `BaseSagaOrchestrator` - Saga 패턴 추상 클래스
  - Saga step interfaces
- **참고 패턴**: `@krgeobuk/msa-commons`의 TcpClientBase, BaseEnrichmentAggregator

#### 1.2 auth-server 신규 구성요소
- ❌ `account_merge_request` 엔티티
- ❌ `AccountMergeOrchestrator` 클래스
- ❌ `account-merge.hbs` 이메일 템플릿
- ❌ HTTP API 엔드포인트 4개
- ❌ 오류 코드 OAUTH_210-215

#### 1.3 authz-server TCP 엔드포인트
- ❌ `user-role.mergeUsers` 메시지 패턴
- ❌ `user-role.rollbackMerge` 메시지 패턴
- **수정 필요**: `UserRoleTcpController`, `UserRoleService`

#### 1.4 my-pick-server 구성요소
- ❌ TCP 서버 활성화 (현재 주석 처리됨)
- ❌ `UserMergeService` 클래스
- ❌ `UserMergeTcpController` 클래스
- ❌ `user.mergeAccounts` 메시지 패턴
- ❌ `user.rollbackMerge` 메시지 패턴

---

### ⚠️ 중요 적응 사항

#### 1. my-pick-server TCP 서버 활성화 필요

**현재 상태** (`my-pick-server/src/main.ts`):
```typescript
// TCP 마이크로서비스 설정 (주석 처리됨)
// app.connectMicroservice<MicroserviceOptions>({
//   transport: Transport.TCP,
//   options: {
//     host: '0.0.0.0',
//     port: tcpPort,
//   },
// });
```

**필요 변경** (✅ **승인됨 - 포트 8310 사용**):
```typescript
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.TCP,
  options: {
    host: '0.0.0.0',
    port: 8310,  // ✅ 확정: 일관된 패턴 유지 (auth: 8010, authz: 8110)
  },
});

await app.startAllMicroservices(); // 추가 필요
```

#### 2. UNIQUE 제약조건 충돌 해결 전략

**문제 테이블**:
- `user_subscriptions` - `UNIQUE(userId, creatorId)`
- `user_interactions` - `UNIQUE(userId, contentId)`

**충돌 시나리오**:
- User A와 User B가 모두 동일한 크리에이터를 구독
- User A와 User B가 모두 동일한 콘텐츠에 상호작용

**해결 전략**: "User A 우선" 원칙
```sql
-- 1단계: User B의 중복 데이터 삭제
DELETE FROM user_subscriptions
WHERE userId = @sourceUserId
  AND creatorId IN (
    SELECT creatorId FROM user_subscriptions
    WHERE userId = @targetUserId
  );

-- 2단계: 나머지 User B 데이터를 User A로 업데이트
UPDATE user_subscriptions
SET userId = @targetUserId
WHERE userId = @sourceUserId;
```

#### 3. 백업 모듈 테이블 처리

**상황**: `reports`와 `report_review` 테이블이 `modules_backup`에 위치
- my-pick-server에서 modules_backup은 현재 사용하지 않음
- 데이터베이스에는 존재하지만 코드는 백업 상태

**✅ 결정 완료**: 병합 대상 제외
- modules_backup 미사용으로 확인됨
- 개발 기간 단축 및 핵심 기능 집중
- 향후 필요 시 수동 병합 가능

---

## 2. 핵심 변경 사항

### 2.1 테이블 병합 우선순위 및 전략 (✅ 최종 확정)

**병합 대상**: 5개 테이블 (reports/report_review 제외)

| 우선순위 | 테이블 | 복잡도 | 상태 | 병합 전략 |
|---------|--------|--------|------|----------|
| **CRITICAL** | `user_subscriptions` | UNIQUE 충돌 | ACTIVE | 중복 삭제 → 업데이트 |
| **CRITICAL** | `user_interactions` | UNIQUE 충돌 | ACTIVE | 중복 삭제 → 업데이트 |
| **HIGH** | `creators` | 단순 FK | ACTIVE | 직접 UPDATE |
| **MEDIUM** | `creator_registrations` | 단순 FK | ACTIVE | 직접 UPDATE |
| **LOW** | `content_moderation` | Optional FK | ACTIVE | 직접 UPDATE (nullable) |
| ~~EXCLUDED~~ | ~~`reports`~~ | ~~단순 FK~~ | BACKUP | ❌ **제외** (미사용) |
| ~~EXCLUDED~~ | ~~`report_review`~~ | ~~Optional FK~~ | BACKUP | ❌ **제외** (미사용) |

### 2.2 Saga 실행 단계 (수정됨)

```
1. STEP1_AUTH_BACKUP
   ├─ User B 스냅샷을 Redis에 백업 (7일 TTL)
   └─ oauth_account.userId 업데이트

2. STEP2_AUTHZ_MERGE
   ├─ TCP 호출: authz-server.user-role.mergeUsers
   ├─ 중복 역할 제거
   └─ User B 역할을 User A로 이전

3. STEP3_MYPICK_MERGE
   ├─ TCP 호출: my-pick-server.user.mergeAccounts
   ├─ CRITICAL: user_subscriptions, user_interactions 중복 처리
   └─ 나머지 테이블 단순 FK 업데이트

4. STEP4_USER_DELETE
   └─ User B 소프트 삭제 (deletedAt = NOW())

5. STEP5_CACHE_INVALIDATE
   ├─ User B 권한 캐시 무효화
   └─ User A 권한 캐시 무효화
```

### 2.3 스마트 재시도 전략 (ACCOUNT_MERGE_PLAN.md에서 유지)

**재시도 가능 오류 (일시적)**:
- `ETIMEDOUT` - 네트워크 타임아웃
- `ECONNREFUSED` - 서비스 재시작 중
- `Lock wait timeout` - DB 락 대기
- HTTP 503, 504, 429

**재시도 불가능 오류 (영구적)**:
- `ER_DUP_ENTRY` - UNIQUE 제약 위반
- `ER_NO_REFERENCED_ROW` - FK 제약 위반
- HTTP 400, 401, 403, 404

**재시도 설정**:
- 최대 3회 재시도
- Exponential backoff: 1초 → 3초 → 5초
- 각 단계 타임아웃: 5초

**예상 성공률**:
- 재시도 없음: 95%
- 스마트 재시도: **99.8%** (4.8% 개선)

---

## 3. 5단계 구현 계획

### 1단계: 공유 패키지 및 기반 작업 (1주차)

#### 1-1. @krgeobuk/saga 패키지 생성 (신규)

**생성 경로**: `shared-lib/packages/saga/`

**디렉토리 구조**:
```
saga/
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
├── package.json
└── tsconfig.json
```

**package.json 템플릿**:
```json
{
  "name": "@krgeobuk/saga",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "sideEffects": false,
  "publishConfig": {
    "registry": "http://localhost:4873/"
  },
  "peerDependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/microservices": "^10.0.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@krgeobuk/tsconfig": "workspace:*",
    "@nestjs/common": "^10.0.0",
    "@nestjs/microservices": "^10.0.0",
    "typescript": "^5.8.3"
  }
}
```

**핵심 구현: RetryUtil**:
```typescript
export class RetryUtil {
  static async executeWithRetry<T>(
    stepName: string,
    fn: () => Promise<T>,
    options: RetryOptions,
    onRetry?: (attempt: number, error: any) => Promise<void>
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
      options.maxDelayMs
    );
  }

  private static createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout after ${ms}ms`)), ms)
    );
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

**핵심 구현: BaseSagaOrchestrator**:
```typescript
export abstract class BaseSagaOrchestrator<TRequest, TSnapshot> {
  protected abstract getSteps(): SagaStep<TRequest>[];
  protected abstract createSnapshot(request: TRequest): Promise<TSnapshot>;
  protected abstract compensate(
    completedSteps: string[],
    snapshot: TSnapshot
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
          step.onRetry
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

**참고할 기존 패턴**:
- `@krgeobuk/msa-commons/clients/TcpClientBase` - TCP 재시도 로직
- `@krgeobuk/msa-commons/aggregators/BaseEnrichmentAggregator` - 데이터 수집 패턴
- `@krgeobuk/msa-commons/strategies/TcpFallbackStrategy` - 보상 트랜잭션 패턴

#### 1-2. auth-server 엔티티 및 Enum

**생성할 파일**:

1. **`auth-server/src/modules/oauth/entities/account-merge-request.entity.ts`**:
```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntityUUID } from '@krgeobuk/core/entities';
import { OAuthAccountProviderType } from '@krgeobuk/oauth/enum';
import { AccountMergeStatus } from '@krgeobuk/oauth/enum';

@Entity('account_merge_request')
export class AccountMergeRequestEntity extends BaseEntityUUID {
  @Column({ type: 'uuid', comment: 'User A (유지할 계정)' })
  targetUserId!: string;

  @Column({ type: 'uuid', comment: 'User B (삭제될 계정)' })
  sourceUserId!: string;

  @Column({ type: 'enum', enum: OAuthAccountProviderType })
  provider!: OAuthAccountProviderType;

  @Column({ type: 'varchar', length: 255 })
  providerId!: string;

  @Column({
    type: 'enum',
    enum: AccountMergeStatus,
    default: AccountMergeStatus.PENDING_EMAIL_VERIFICATION,
  })
  status!: AccountMergeStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'datetime', nullable: true })
  emailVerifiedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;
}
```

2. **`shared-lib/packages/oauth/src/enum/account-merge-status.enum.ts`**:
```typescript
export enum AccountMergeStatus {
  PENDING_EMAIL_VERIFICATION = 'PENDING_EMAIL_VERIFICATION',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  IN_PROGRESS = 'IN_PROGRESS',
  STEP1_AUTH_BACKUP = 'STEP1_AUTH_BACKUP',
  STEP2_AUTHZ_MERGE = 'STEP2_AUTHZ_MERGE',
  STEP3_MYPICK_MERGE = 'STEP3_MYPICK_MERGE',
  STEP4_USER_DELETE = 'STEP4_USER_DELETE',
  STEP5_CACHE_INVALIDATE = 'STEP5_CACHE_INVALIDATE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  CANCELLED = 'CANCELLED',
}
```

3. **`shared-lib/packages/oauth/src/codes/oauth-code.constant.ts`** (추가):
```typescript
// 기존 코드에 추가
export const OAUTH_ERROR_CODES = {
  // ... 기존 코드들
  OAUTH_210: 'OAUTH_210', // 병합 요청 생성 실패
  OAUTH_211: 'OAUTH_211', // 확인 이메일 발송 실패
  OAUTH_212: 'OAUTH_212', // 유효하지 않거나 만료된 토큰
  OAUTH_213: 'OAUTH_213', // 병합 실행 실패
  OAUTH_214: 'OAUTH_214', // 취소 불가 (진행 중)
  OAUTH_215: 'OAUTH_215', // 병합 요청 없음
};
```

#### 1-3. 이메일 템플릿 생성

**생성할 파일**: `shared-lib/packages/email/src/templates/files/account-merge.hbs`

**템플릿 내용**:
```handlebars
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>계정 병합 확인</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: #667eea;
      color: white !important;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .warning {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
    }
    .critical {
      background: #f8d7da;
      border-left: 4px solid #dc3545;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
    }
    .info-box {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔗 계정 병합 확인 요청</h1>
  </div>

  <div class="content">
    <h2>안녕하세요, {{name}}님</h2>

    <div class="critical">
      <strong>⚠️ 중요한 계정 변경 사항</strong><br>
      다른 사용자({{targetUserEmail}})가 회원님의 OAuth 계정을 자신의 계정에 연결하려고 합니다.
    </div>

    <div class="info-box">
      <h3>📋 병합 요청 정보</h3>
      <ul>
        <li><strong>요청한 사용자:</strong> {{targetUserEmail}}</li>
        <li><strong>병합 대상 계정:</strong> {{provider}} ({{providerId}})</li>
        <li><strong>만료 시간:</strong> {{expiresAt}} (24시간)</li>
      </ul>
    </div>

    <div class="warning">
      <strong>🔍 이 작업의 의미</strong><br>
      확인 시 회원님의 모든 데이터(역할, 구독, 상호작용 등)가 상대방 계정으로 이전되며,
      회원님의 현재 계정은 삭제됩니다.
    </div>

    <p style="text-align: center;">
      <strong>이 요청을 승인하시려면 아래 버튼을 클릭하세요:</strong>
    </p>

    <div style="text-align: center;">
      <a href="{{confirmUrl}}" class="button">
        ✅ 계정 병합 승인
      </a>
    </div>

    <div class="warning">
      <strong>⏰ 보안 안내</strong>
      <ul>
        <li>이 링크는 24시간 동안만 유효합니다</li>
        <li>한 번만 사용할 수 있습니다</li>
        <li>요청하지 않은 경우 이 이메일을 무시하세요</li>
        <li>의심스러운 경우 관리자에게 문의하세요</li>
      </ul>
    </div>

    <p style="font-size: 14px; color: #666;">
      버튼이 작동하지 않는 경우, 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
      <code style="background: #eee; padding: 5px; display: block; margin-top: 10px; word-break: break-all;">{{confirmUrl}}</code>
    </p>
  </div>

  <div class="footer">
    <p>이 이메일은 krgeobuk 계정 보안을 위해 자동으로 발송되었습니다.</p>
    <p>&copy; 2026 krgeobuk. All rights reserved.</p>
  </div>
</body>
</html>
```

**EmailService 메서드 추가**:
```typescript
// shared-lib/packages/email/src/services/email.service.ts
async sendAccountMergeEmail(options: {
  to: string;
  name: string;
  targetUserEmail: string;
  provider: string;
  providerId: string;
  confirmUrl: string;
  expiresAt: string;
}): Promise<void> {
  await this.sendEmail({
    to: options.to,
    subject: '[krgeobuk] 계정 병합 확인 요청',
    templateName: 'account-merge',
    templateData: options,
  });
}
```

#### 1-4. 패키지 빌드 및 게시

```bash
# @krgeobuk/saga 패키지 빌드
cd shared-lib/packages/saga
pnpm install
pnpm build

# Verdaccio에 게시
pnpm publish --registry http://localhost:4873

# auth-server에 설치
cd ../../../auth-server
pnpm add @krgeobuk/saga@latest
```

**완료 기준**:
- ✅ @krgeobuk/saga 패키지 빌드 성공
- ✅ Verdaccio에 게시 완료
- ✅ account_merge_request 엔티티 생성
- ✅ account-merge.hbs 템플릿 생성
- ✅ OAuth 오류 코드 추가

---

### 2단계: 오케스트레이터 핵심 (2주차)

#### 2-1. AccountMergeOrchestrator 구현

**생성할 파일**: `auth-server/src/modules/oauth/account-merge.orchestrator.ts`

**전체 구현**:
```typescript
import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { BaseSagaOrchestrator, SagaStep, RetryOptions } from '@krgeobuk/saga';
import { AccountMergeRequestEntity } from './entities/account-merge-request.entity';
import { OAuthService } from './oauth.service';
import { UserService } from '../user/user.service';
import { RedisService } from '../../database/redis/redis.service';
import { AccountMergeStatus } from '@krgeobuk/oauth/enum';

interface MergeSnapshot {
  sourceUser: any;
  sourceOAuthAccounts: any[];
  sourceRoles: any[];
  sourceMyPickData: any;
  backupTimestamp: Date;
}

@Injectable()
export class AccountMergeOrchestrator extends BaseSagaOrchestrator<
  AccountMergeRequestEntity,
  MergeSnapshot
> {
  private readonly logger = new Logger(AccountMergeOrchestrator.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    @Inject('AUTHZ_SERVICE') private readonly authzClient: ClientProxy,
    @Inject('MYPICK_SERVICE') private readonly myPickClient: ClientProxy
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
        onRetry: (attempt, error) => this.logRetry('STEP1_AUTH_BACKUP', attempt, error),
      },
      {
        name: 'STEP2_AUTHZ_MERGE',
        execute: (req) => this.mergeRoles(req),
        retryOptions: defaultRetryOptions,
        onRetry: (attempt, error) => this.logRetry('STEP2_AUTHZ_MERGE', attempt, error),
      },
      {
        name: 'STEP3_MYPICK_MERGE',
        execute: (req) => this.mergeMyPickData(req),
        retryOptions: defaultRetryOptions,
        onRetry: (attempt, error) => this.logRetry('STEP3_MYPICK_MERGE', attempt, error),
      },
      {
        name: 'STEP4_USER_DELETE',
        execute: (req) => this.softDeleteUser(req),
        retryOptions: defaultRetryOptions,
        onRetry: (attempt, error) => this.logRetry('STEP4_USER_DELETE', attempt, error),
      },
      {
        name: 'STEP5_CACHE_INVALIDATE',
        execute: (req) => this.invalidateCache(req),
        retryOptions: { ...defaultRetryOptions, maxRetries: 1 }, // 캐시는 재시도 1회만
        onRetry: (attempt, error) => this.logRetry('STEP5_CACHE_INVALIDATE', attempt, error),
      },
    ];
  }

  protected async createSnapshot(request: AccountMergeRequestEntity): Promise<MergeSnapshot> {
    this.logger.log('Creating snapshot', { sourceUserId: request.sourceUserId });

    const sourceUser = await this.userService.findById(request.sourceUserId);
    const sourceOAuthAccounts = await this.oauthService.findByUserId(request.sourceUserId);

    // authz-server에서 역할 조회
    const sourceRoles = await firstValueFrom(
      this.authzClient
        .send('user-role.find-roles-by-user', { userId: request.sourceUserId })
        .pipe(timeout(5000))
    );

    // my-pick-server 스냅샷은 서버에서 생성
    const snapshot: MergeSnapshot = {
      sourceUser,
      sourceOAuthAccounts,
      sourceRoles,
      sourceMyPickData: {}, // my-pick-server에서 자체 스냅샷 생성
      backupTimestamp: new Date(),
    };

    // Redis에 7일간 백업 저장
    await this.redisService.setExValue(
      `merge:snapshot:${request.id}`,
      604800, // 7일
      JSON.stringify(snapshot)
    );

    return snapshot;
  }

  protected async compensate(
    completedSteps: string[],
    snapshot: MergeSnapshot
  ): Promise<void> {
    this.logger.warn('Starting compensation', { completedSteps });

    for (const stepName of completedSteps) {
      try {
        switch (stepName) {
          case 'STEP5_CACHE_INVALIDATE':
            // 캐시 롤백 불필요
            this.logger.log('Skipping cache invalidation rollback');
            break;

          case 'STEP4_USER_DELETE':
            await this.restoreUser(snapshot);
            break;

          case 'STEP3_MYPICK_MERGE':
            await this.rollbackMyPickMerge(snapshot);
            break;

          case 'STEP2_AUTHZ_MERGE':
            await this.rollbackRoleMerge(snapshot);
            break;

          case 'STEP1_AUTH_BACKUP':
            await this.restoreOAuthAccounts(snapshot);
            break;
        }

        this.logger.log(`Compensation succeeded for ${stepName}`);
      } catch (error) {
        this.logger.error(`Compensation failed for ${stepName}`, error);
        // TODO: 관리자 알림 전송
      }
    }
  }

  // ==================== STEP 구현 ====================

  private async backupAndMergeOAuth(request: AccountMergeRequestEntity): Promise<void> {
    this.logger.log('Executing STEP1: OAuth account merge');

    // OAuth 계정을 sourceUser에서 targetUser로 이전
    await this.oauthService.transferOAuthAccount(
      request.sourceUserId,
      request.targetUserId,
      request.provider,
      request.providerId
    );

    this.logger.log('STEP1 completed: OAuth account transferred');
  }

  private async mergeRoles(request: AccountMergeRequestEntity): Promise<void> {
    this.logger.log('Executing STEP2: Role merge');

    const result = await firstValueFrom(
      this.authzClient
        .send('user-role.merge-users', {
          targetUserId: request.targetUserId,
          sourceUserId: request.sourceUserId,
        })
        .pipe(timeout(5000))
    );

    if (!result.success) {
      throw new Error(`Role merge failed: ${result.message}`);
    }

    this.logger.log(`STEP2 completed: ${result.data.transferredRoles} roles transferred`);
  }

  private async mergeMyPickData(request: AccountMergeRequestEntity): Promise<void> {
    this.logger.log('Executing STEP3: my-pick data merge');

    const result = await firstValueFrom(
      this.myPickClient
        .send('user.merge-accounts', {
          targetUserId: request.targetUserId,
          sourceUserId: request.sourceUserId,
        })
        .pipe(timeout(10000)) // my-pick은 10초 타임아웃 (여러 테이블 처리)
    );

    if (!result.success) {
      throw new Error(`my-pick merge failed: ${result.message}`);
    }

    this.logger.log('STEP3 completed: my-pick data merged', result.data.stats);
  }

  private async softDeleteUser(request: AccountMergeRequestEntity): Promise<void> {
    this.logger.log('Executing STEP4: User soft delete');

    await this.userService.softDelete(request.sourceUserId);

    this.logger.log('STEP4 completed: User soft deleted');
  }

  private async invalidateCache(request: AccountMergeRequestEntity): Promise<void> {
    this.logger.log('Executing STEP5: Cache invalidation');

    // User B 권한 캐시 삭제
    await this.redisService.deleteValue(`user:${request.sourceUserId}:permissions`);

    // User A 권한 캐시 삭제 (새 역할 반영)
    await this.redisService.deleteValue(`user:${request.targetUserId}:permissions`);

    this.logger.log('STEP5 completed: Cache invalidated');
  }

  // ==================== 보상 트랜잭션 ====================

  private async restoreUser(snapshot: MergeSnapshot): Promise<void> {
    await this.userService.restore(snapshot.sourceUser.id);
  }

  private async rollbackMyPickMerge(snapshot: MergeSnapshot): Promise<void> {
    await firstValueFrom(
      this.myPickClient
        .send('user.rollback-merge', { snapshotData: snapshot.sourceMyPickData })
        .pipe(timeout(10000))
    );
  }

  private async rollbackRoleMerge(snapshot: MergeSnapshot): Promise<void> {
    await firstValueFrom(
      this.authzClient
        .send('user-role.rollback-merge', { snapshotData: snapshot.sourceRoles })
        .pipe(timeout(5000))
    );
  }

  private async restoreOAuthAccounts(snapshot: MergeSnapshot): Promise<void> {
    // OAuth 계정 복원 로직
    for (const account of snapshot.sourceOAuthAccounts) {
      await this.oauthService.restore(account);
    }
  }

  // ==================== 유틸리티 ====================

  private async logRetry(stepName: string, attempt: number, error: any): Promise<void> {
    this.logger.warn(`Retry ${stepName} (attempt ${attempt})`, {
      error: error.message,
      code: error.code,
    });
  }
}
```

#### 2-2. OAuth Service 수정

**수정할 파일**: `auth-server/src/modules/oauth/oauth.service.ts`

**Line 368-372 수정 전**:
```typescript
if (existingOAuth.length > 0 && existingOAuth[0]?.userId !== userId) {
  throw OAuthException.alreadyLinkedToAnotherAccount(provider);
}
```

**수정 후**:
```typescript
if (existingOAuth.length > 0 && existingOAuth[0]?.userId !== userId) {
  // 병합 요청 생성 (예외 발생 대신)
  return await this.createMergeRequest(
    userId,                      // targetUserId (User A)
    existingOAuth[0].userId,     // sourceUserId (User B)
    provider,
    userInfo.id                  // providerId
  );
}
```

**추가 메서드**:
```typescript
// oauth.service.ts
async createMergeRequest(
  targetUserId: string,
  sourceUserId: string,
  provider: OAuthAccountProviderType,
  providerId: string
): Promise<AccountMergeRequestEntity> {
  // 병합 요청 엔티티 생성
  const mergeRequest = this.mergeRequestRepository.create({
    targetUserId,
    sourceUserId,
    provider,
    providerId,
    status: AccountMergeStatus.PENDING_EMAIL_VERIFICATION,
  });

  await this.mergeRequestRepository.save(mergeRequest);

  // 토큰 생성 및 이메일 발송
  await this.sendMergeConfirmationEmail(mergeRequest);

  return mergeRequest;
}

async transferOAuthAccount(
  sourceUserId: string,
  targetUserId: string,
  provider: OAuthAccountProviderType,
  providerId: string
): Promise<void> {
  await this.oauthRepository.update(
    { userId: sourceUserId, provider, providerId },
    { userId: targetUserId }
  );
}
```

**완료 기준**:
- ✅ AccountMergeOrchestrator 구현 완료
- ✅ OAuth service 수정 완료
- ✅ 단위 테스트 작성 및 통과

---

### 3단계: 서비스 병합 로직 (3주차)

#### 3-1. authz-server TCP 엔드포인트 추가

**Step 1: TCP 패턴 추가**

파일: `shared-lib/packages/user-role/src/tcp/patterns/patterns.ts`
```typescript
export const UserRoleTcpPatterns = {
  FIND_ROLES_BY_USER: 'user-role.find-roles-by-user',
  FIND_USERS_BY_ROLE: 'user-role.find-users-by-role',
  EXISTS: 'user-role.exists',
  ASSIGN_MULTIPLE: 'user-role.assign-multiple',
  REVOKE_MULTIPLE: 'user-role.revoke-multiple',
  REPLACE_ROLES: 'user-role.replace-roles',

  // 신규 추가
  MERGE_USERS: 'user-role.merge-users',
  ROLLBACK_MERGE: 'user-role.rollback-merge',
} as const;
```

**Step 2: TCP 인터페이스 추가**

파일: `shared-lib/packages/user-role/src/tcp/interfaces/tcp-requests.interface.ts`
```typescript
export interface TcpMergeUsers {
  targetUserId: string; // User A (유지)
  sourceUserId: string; // User B (삭제)
}

export interface TcpRollbackMerge {
  snapshotData: {
    roleIds: string[];
    userId: string;
  };
}
```

**Step 3: UserRoleService 병합 메서드 추가**

파일: `authz-server/src/modules/user-role/user-role.service.ts`
```typescript
/**
 * User B의 역할을 User A로 이전
 * User A가 이미 가진 역할은 건너뛰기
 */
async mergeUsers(targetUserId: string, sourceUserId: string): Promise<number> {
  return await this.userRoleRepository.manager.transaction(async (manager) => {
    // 1. Source user의 역할 조회
    const sourceRoles = await manager
      .createQueryBuilder('user_role', 'ur')
      .where('ur.userId = :userId', { userId: sourceUserId })
      .select('ur.roleId')
      .getRawMany();

    const sourceRoleIds = sourceRoles.map((r) => r.roleId);

    if (sourceRoleIds.length === 0) {
      this.logger.log('No roles to transfer');
      return 0;
    }

    // 2. Target user가 이미 가진 역할 조회
    const targetRoles = await manager
      .createQueryBuilder('user_role', 'ur')
      .where('ur.userId = :userId', { userId: targetUserId })
      .andWhere('ur.roleId IN (:...roleIds)', { roleIds: sourceRoleIds })
      .select('ur.roleId')
      .getRawMany();

    const targetRoleIds = targetRoles.map((r) => r.roleId);

    // 3. 중복 제거
    const rolesToTransfer = sourceRoleIds.filter(
      (roleId) => !targetRoleIds.includes(roleId)
    );

    if (rolesToTransfer.length === 0) {
      this.logger.log('All roles already exist in target user');

      // Source user 역할만 삭제
      await manager
        .createQueryBuilder()
        .delete()
        .from('user_role')
        .where('userId = :userId', { userId: sourceUserId })
        .execute();

      return 0;
    }

    // 4. 역할 이전
    const insertValues = rolesToTransfer.map((roleId) => ({
      userId: targetUserId,
      roleId,
    }));

    await manager
      .createQueryBuilder()
      .insert()
      .into('user_role')
      .values(insertValues)
      .execute();

    // 5. Source user 역할 삭제
    await manager
      .createQueryBuilder()
      .delete()
      .from('user_role')
      .where('userId = :userId', { userId: sourceUserId })
      .execute();

    this.logger.log(`Transferred ${rolesToTransfer.length} roles`, {
      targetUserId,
      sourceUserId,
      transferredRoles: rolesToTransfer,
    });

    return rolesToTransfer.length;
  });
}

/**
 * 스냅샷에서 역할 복원
 */
async restoreFromSnapshot(snapshotData: {
  roleIds: string[];
  userId: string;
}): Promise<void> {
  const { roleIds, userId } = snapshotData;

  await this.userRoleRepository.manager.transaction(async (manager) => {
    // 기존 역할 삭제 (롤백 시)
    await manager
      .createQueryBuilder()
      .delete()
      .from('user_role')
      .where('userId = :userId', { userId })
      .execute();

    // 스냅샷 역할 복원
    if (roleIds.length > 0) {
      const insertValues = roleIds.map((roleId) => ({ userId, roleId }));

      await manager
        .createQueryBuilder()
        .insert()
        .into('user_role')
        .values(insertValues)
        .execute();
    }

    this.logger.log(`Restored ${roleIds.length} roles from snapshot`, { userId });
  });
}
```

**Step 4: UserRoleTcpController 메서드 추가**

파일: `authz-server/src/modules/user-role/user-role-tcp.controller.ts`
```typescript
import { UserRoleTcpPatterns } from '@krgeobuk/user-role/tcp/patterns';
import type { TcpMergeUsers, TcpRollbackMerge } from '@krgeobuk/user-role/tcp/interfaces';
import { TcpOperationResponse } from '@krgeobuk/core/interfaces';

@Controller()
export class UserRoleTcpController {
  private readonly logger = new Logger(UserRoleTcpController.name);

  constructor(private readonly userRoleService: UserRoleService) {}

  // ... 기존 메서드들 ...

  @MessagePattern(UserRoleTcpPatterns.MERGE_USERS)
  async mergeUsers(@Payload() data: TcpMergeUsers): Promise<TcpOperationResponse> {
    try {
      this.logger.debug('TCP merge-users requested', {
        targetUserId: data.targetUserId,
        sourceUserId: data.sourceUserId,
      });

      const transferredRoles = await this.userRoleService.mergeUsers(
        data.targetUserId,
        data.sourceUserId
      );

      return {
        success: true,
        data: { transferredRoles },
        message: `Successfully merged roles`,
      };
    } catch (error: unknown) {
      this.logger.error('TCP merge-users failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetUserId: data.targetUserId,
        sourceUserId: data.sourceUserId,
      });
      throw error;
    }
  }

  @MessagePattern(UserRoleTcpPatterns.ROLLBACK_MERGE)
  async rollbackMerge(@Payload() data: TcpRollbackMerge): Promise<TcpOperationResponse> {
    try {
      this.logger.debug('TCP rollback-merge requested', {
        userId: data.snapshotData.userId,
        roleCount: data.snapshotData.roleIds.length,
      });

      await this.userRoleService.restoreFromSnapshot(data.snapshotData);

      return {
        success: true,
        message: 'Successfully rolled back role merge',
      };
    } catch (error: unknown) {
      this.logger.error('TCP rollback-merge failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.snapshotData.userId,
      });
      throw error;
    }
  }
}
```

#### 3-2. my-pick-server TCP 서버 및 병합 로직

**Step 1: TCP 서버 활성화**

파일: `my-pick-server/src/main.ts`
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ... 기존 HTTP 서버 설정 ...

  // TCP 마이크로서비스 활성화
  const configService = app.get(ConfigService);
  const tcpPort = configService.get<number>('tcp.port', 8310);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: tcpPort,
    },
  });

  await app.startAllMicroservices();
  await app.listen(configService.get<number>('port', 8300));

  Logger.log(`HTTP server running on port ${configService.get<number>('port', 8300)}`);
  Logger.log(`TCP server running on port ${tcpPort}`);
}
```

**환경 변수 추가** (`my-pick-server/envs/local.env`):
```bash
# TCP Server Configuration
TCP_PORT=8310
```

**Step 2: TCP 패턴 추가**

파일: `shared-lib/packages/user/src/tcp/patterns/patterns.ts`
```typescript
export const UserTcpPatterns = {
  FIND_BY_ID: 'user.find-by-id',
  FIND_BY_IDS: 'user.find-by-ids',

  // 신규 추가
  MERGE_ACCOUNTS: 'user.merge-accounts',
  ROLLBACK_MERGE: 'user.rollback-merge',
} as const;
```

**Step 3: UserMergeService 생성**

파일: `my-pick-server/src/modules/user/user-merge.service.ts`
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface MergeStats {
  creators: number;
  subscriptions: number;
  subscriptionsDeleted: number;
  interactions: number;
  interactionsDeleted: number;
  registrations: number;
  moderations: number;
}

@Injectable()
export class UserMergeService {
  private readonly logger = new Logger(UserMergeService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * User B의 모든 데이터를 User A로 병합
   * UNIQUE 제약조건 충돌 처리: User A 우선, User B 중복 삭제
   */
  async mergeAccounts(targetUserId: string, sourceUserId: string): Promise<MergeStats> {
    this.logger.log('Starting account merge', { targetUserId, sourceUserId });

    return await this.dataSource.transaction(async (manager) => {
      const stats: MergeStats = {
        creators: 0,
        subscriptions: 0,
        subscriptionsDeleted: 0,
        interactions: 0,
        interactionsDeleted: 0,
        registrations: 0,
        moderations: 0,
      };

      // 1. creators (단순 FK 업데이트)
      const creatorsResult = await manager
        .createQueryBuilder()
        .update('creators')
        .set({ userId: targetUserId })
        .where('userId = :sourceUserId', { sourceUserId })
        .execute();
      stats.creators = creatorsResult.affected || 0;

      // 2. user_subscriptions (CRITICAL: UNIQUE 충돌 처리)
      // 2-1. 중복 데이터 조회
      const duplicateSubscriptions = await manager
        .createQueryBuilder()
        .select('creatorId')
        .from('user_subscriptions', 'us')
        .where('us.userId = :sourceUserId', { sourceUserId })
        .andWhere(
          `us.creatorId IN (SELECT creatorId FROM user_subscriptions WHERE userId = :targetUserId)`,
          { targetUserId }
        )
        .getRawMany();

      if (duplicateSubscriptions.length > 0) {
        const duplicateCreatorIds = duplicateSubscriptions.map((d) => d.creatorId);

        // 2-2. User B의 중복 구독 삭제
        const deleteResult = await manager
          .createQueryBuilder()
          .delete()
          .from('user_subscriptions')
          .where('userId = :sourceUserId', { sourceUserId })
          .andWhere('creatorId IN (:...creatorIds)', { creatorIds: duplicateCreatorIds })
          .execute();

        stats.subscriptionsDeleted = deleteResult.affected || 0;

        this.logger.warn('Deleted duplicate subscriptions', {
          count: stats.subscriptionsDeleted,
          duplicateCreatorIds,
        });
      }

      // 2-3. 나머지 구독 업데이트
      const subsResult = await manager
        .createQueryBuilder()
        .update('user_subscriptions')
        .set({ userId: targetUserId })
        .where('userId = :sourceUserId', { sourceUserId })
        .execute();
      stats.subscriptions = subsResult.affected || 0;

      // 3. user_interactions (CRITICAL: UNIQUE 충돌 처리)
      // 3-1. 중복 데이터 조회
      const duplicateInteractions = await manager
        .createQueryBuilder()
        .select('contentId')
        .from('user_interactions', 'ui')
        .where('ui.userId = :sourceUserId', { sourceUserId })
        .andWhere(
          `ui.contentId IN (SELECT contentId FROM user_interactions WHERE userId = :targetUserId)`,
          { targetUserId }
        )
        .getRawMany();

      if (duplicateInteractions.length > 0) {
        const duplicateContentIds = duplicateInteractions.map((d) => d.contentId);

        // 3-2. User B의 중복 상호작용 삭제
        const deleteResult = await manager
          .createQueryBuilder()
          .delete()
          .from('user_interactions')
          .where('userId = :sourceUserId', { sourceUserId })
          .andWhere('contentId IN (:...contentIds)', { contentIds: duplicateContentIds })
          .execute();

        stats.interactionsDeleted = deleteResult.affected || 0;

        this.logger.warn('Deleted duplicate interactions', {
          count: stats.interactionsDeleted,
          duplicateContentIds,
        });
      }

      // 3-3. 나머지 상호작용 업데이트
      const interactionsResult = await manager
        .createQueryBuilder()
        .update('user_interactions')
        .set({ userId: targetUserId })
        .where('userId = :sourceUserId', { sourceUserId })
        .execute();
      stats.interactions = interactionsResult.affected || 0;

      // 4. creator_registrations (단순 FK 업데이트)
      const registrationsResult = await manager
        .createQueryBuilder()
        .update('creator_registrations')
        .set({ userId: targetUserId })
        .where('userId = :sourceUserId', { sourceUserId })
        .execute();
      stats.registrations = registrationsResult.affected || 0;

      // 5. content_moderation (Optional FK 업데이트)
      const moderationsResult = await manager
        .createQueryBuilder()
        .update('content_moderation')
        .set({ moderatorId: targetUserId })
        .where('moderatorId = :sourceUserId', { sourceUserId })
        .execute();
      stats.moderations = moderationsResult.affected || 0;

      // TODO: reports, report_review (modules_backup)
      // 사용자 결정에 따라 추가 구현

      this.logger.log('Account merge completed', stats);

      return stats;
    });
  }

  /**
   * 병합 롤백 (스냅샷에서 복원)
   */
  async rollbackMerge(snapshotData: any): Promise<void> {
    this.logger.warn('Rolling back merge', { snapshotData });

    // 스냅샷 기반 복원 로직
    // 실제 구현은 스냅샷 구조에 따라 결정

    this.logger.log('Rollback completed');
  }
}
```

**Step 4: UserMergeTcpController 생성**

파일: `my-pick-server/src/modules/user/user-merge-tcp.controller.ts`
```typescript
import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserTcpPatterns } from '@krgeobuk/user/tcp/patterns';
import { UserMergeService } from './user-merge.service';

@Controller()
export class UserMergeTcpController {
  private readonly logger = new Logger(UserMergeTcpController.name);

  constructor(private readonly userMergeService: UserMergeService) {}

  @MessagePattern(UserTcpPatterns.MERGE_ACCOUNTS)
  async mergeAccounts(
    @Payload() data: { targetUserId: string; sourceUserId: string }
  ) {
    try {
      this.logger.debug('TCP merge-accounts requested', data);

      const stats = await this.userMergeService.mergeAccounts(
        data.targetUserId,
        data.sourceUserId
      );

      return {
        success: true,
        data: { stats },
        message: 'Accounts merged successfully',
      };
    } catch (error: unknown) {
      this.logger.error('TCP merge-accounts failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
      });
      throw error;
    }
  }

  @MessagePattern(UserTcpPatterns.ROLLBACK_MERGE)
  async rollbackMerge(@Payload() data: { snapshotData: any }) {
    try {
      this.logger.debug('TCP rollback-merge requested');

      await this.userMergeService.rollbackMerge(data.snapshotData);

      return {
        success: true,
        message: 'Merge rollback successful',
      };
    } catch (error: unknown) {
      this.logger.error('TCP rollback-merge failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
```

**Step 5: UserModule에 등록**

파일: `my-pick-server/src/modules/user/user.module.ts`
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([/* entities */])],
  controllers: [UserMergeTcpController], // 추가
  providers: [UserMergeService],         // 추가
  exports: [UserMergeService],
})
export class UserModule {}
```

**완료 기준**:
- ✅ authz-server TCP 엔드포인트 구현 완료
- ✅ my-pick-server TCP 서버 활성화
- ✅ my-pick-server 병합 로직 구현 완료
- ✅ TCP 통신 테스트 통과

---

### 4단계: 보상 트랜잭션 (4주차)

> **Note**: 보상 로직의 상당 부분은 2단계 AccountMergeOrchestrator에서 이미 구현됨.
> 이 단계에서는 각 서비스의 롤백 메서드를 완성하고 테스트함.

#### 4-1. auth-server 보상 트랜잭션

**auth-server/src/modules/oauth/account-merge.orchestrator.ts**에 이미 구현됨:
- `restoreUser()` - User 소프트 삭제 취소
- `restoreOAuthAccounts()` - OAuth 계정 복원
- `compensate()` - 전체 보상 흐름 조율

**추가 필요: UserService 복원 메서드**

파일: `auth-server/src/modules/user/user.service.ts`
```typescript
async softDelete(userId: string): Promise<void> {
  await this.userRepository.update(userId, {
    deletedAt: new Date(),
  });
}

async restore(userId: string): Promise<void> {
  await this.userRepository.update(userId, {
    deletedAt: null,
  });
}
```

#### 4-2. authz-server 보상 트랜잭션

**3단계에서 이미 구현됨**:
- `UserRoleService.restoreFromSnapshot()` - 역할 스냅샷 복원
- `UserRoleTcpController.rollbackMerge()` - TCP 엔드포인트

**테스트 시나리오**:
1. 역할 병합 후 롤백 호출
2. Source user 역할이 정확히 복원되는지 확인
3. Target user 역할이 변경되지 않았는지 확인

#### 4-3. my-pick-server 보상 트랜잭션

**UserMergeService.rollbackMerge() 상세 구현**:

파일: `my-pick-server/src/modules/user/user-merge.service.ts`
```typescript
async rollbackMerge(snapshotData: {
  sourceUserId: string;
  targetUserId: string;
  creators: any[];
  subscriptions: any[];
  interactions: any[];
  registrations: any[];
  moderations: any[];
}): Promise<void> {
  this.logger.warn('Starting merge rollback', {
    sourceUserId: snapshotData.sourceUserId,
    targetUserId: snapshotData.targetUserId,
  });

  await this.dataSource.transaction(async (manager) => {
    // 1. creators 롤백
    if (snapshotData.creators.length > 0) {
      const creatorIds = snapshotData.creators.map((c) => c.id);
      await manager
        .createQueryBuilder()
        .update('creators')
        .set({ userId: snapshotData.sourceUserId })
        .where('id IN (:...ids)', { ids: creatorIds })
        .execute();
    }

    // 2. user_subscriptions 롤백
    if (snapshotData.subscriptions.length > 0) {
      // 2-1. 병합된 구독을 source로 되돌리기
      const mergedSubs = snapshotData.subscriptions.filter((s) => !s.wasDeleted);
      for (const sub of mergedSubs) {
        await manager
          .createQueryBuilder()
          .update('user_subscriptions')
          .set({ userId: snapshotData.sourceUserId })
          .where('userId = :targetUserId', { targetUserId: snapshotData.targetUserId })
          .andWhere('creatorId = :creatorId', { creatorId: sub.creatorId })
          .execute();
      }

      // 2-2. 삭제된 중복 구독 복원
      const deletedSubs = snapshotData.subscriptions.filter((s) => s.wasDeleted);
      if (deletedSubs.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into('user_subscriptions')
          .values(deletedSubs.map((s) => ({
            userId: snapshotData.sourceUserId,
            creatorId: s.creatorId,
            notificationEnabled: s.notificationEnabled,
            subscribedAt: s.subscribedAt,
          })))
          .execute();
      }
    }

    // 3. user_interactions 롤백 (subscriptions와 동일 패턴)
    if (snapshotData.interactions.length > 0) {
      const mergedInteractions = snapshotData.interactions.filter((i) => !i.wasDeleted);
      for (const interaction of mergedInteractions) {
        await manager
          .createQueryBuilder()
          .update('user_interactions')
          .set({ userId: snapshotData.sourceUserId })
          .where('userId = :targetUserId', { targetUserId: snapshotData.targetUserId })
          .andWhere('contentId = :contentId', { contentId: interaction.contentId })
          .execute();
      }

      const deletedInteractions = snapshotData.interactions.filter((i) => i.wasDeleted);
      if (deletedInteractions.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into('user_interactions')
          .values(deletedInteractions.map((i) => ({
            userId: snapshotData.sourceUserId,
            contentId: i.contentId,
            isBookmarked: i.isBookmarked,
            isLiked: i.isLiked,
            watchedAt: i.watchedAt,
            watchDuration: i.watchDuration,
            rating: i.rating,
          })))
          .execute();
      }
    }

    // 4. creator_registrations, content_moderation 롤백
    // (creators와 동일한 단순 UPDATE 패턴)
  });

  this.logger.log('Rollback completed successfully');
}
```

**스냅샷 생성 로직 개선 필요**:
- `mergeAccounts()` 실행 전에 스냅샷 생성
- 삭제된 레코드(`wasDeleted: true`)도 스냅샷에 포함
- auth-server orchestrator에서 my-pick-server에 스냅샷 생성 요청 추가

#### 4-4. 관리자 복구 기능

**생성할 파일**: `auth-server/src/modules/admin/admin-merge.controller.ts`

```typescript
@Controller('admin/account-merge')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminMergeController {
  constructor(
    private readonly orchestrator: AccountMergeOrchestrator,
    private readonly mergeService: AccountMergeService
  ) {}

  @Post(':mergeRequestId/rollback')
  @ApiOperation({ summary: '관리자 수동 롤백' })
  async manualRollback(@Param('mergeRequestId') id: string) {
    const mergeRequest = await this.mergeService.findById(id);

    // Redis에서 스냅샷 복원
    const snapshot = await this.redisService.getValue(`merge:snapshot:${id}`);

    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    // 보상 트랜잭션 실행
    await this.orchestrator.compensate(
      ['STEP5', 'STEP4', 'STEP3', 'STEP2', 'STEP1'],
      JSON.parse(snapshot)
    );

    return { success: true };
  }

  @Get('failed')
  @ApiOperation({ summary: '실패한 병합 요청 조회' })
  async getFailedMerges() {
    return await this.mergeService.findByStatus([
      AccountMergeStatus.FAILED,
      AccountMergeStatus.COMPENSATING,
    ]);
  }
}
```

**완료 기준**:
- ✅ 모든 서비스의 롤백 메서드 구현 완료
- ✅ 롤백 시나리오 테스트 통과
- ✅ 관리자 복구 기능 구현
- ✅ 실패 알림 시스템 구축

---

### 5단계: API 및 통합 (5주차)

#### 5-1. HTTP API 엔드포인트 구현

**생성할 파일**: `auth-server/src/modules/oauth/oauth-merge.controller.ts`

```typescript
import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@krgeobuk/jwt/guards';
import { CurrentUser } from '@krgeobuk/jwt/decorators';
import { ApiResponse } from '@krgeobuk/core/response';
import { AccountMergeService } from './account-merge.service';
import { AccountMergeOrchestrator } from './account-merge.orchestrator';
import { RequestMergeDto, MergeStatusResponse } from './dto/merge.dto';

@ApiTags('OAuth Account Merge')
@Controller('oauth/account-merge')
export class OAuthMergeController {
  constructor(
    private readonly mergeService: AccountMergeService,
    private readonly orchestrator: AccountMergeOrchestrator
  ) {}

  @Post('request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '계정 병합 요청 생성' })
  async requestMerge(
    @CurrentUser() user: { id: string },
    @Body() dto: RequestMergeDto
  ): Promise<ApiResponse<any>> {
    const result = await this.mergeService.createMergeRequest(
      user.id,
      dto.provider,
      dto.providerId
    );

    return ApiResponse.success({
      mergeRequestId: result.id,
      targetUserId: result.targetUserId,
      sourceUserEmail: result.sourceUserEmail,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  @Get('confirm')
  @ApiOperation({ summary: '이메일 링크로 병합 확인 (토큰 검증)' })
  async confirmMerge(@Query('token') token: string): Promise<ApiResponse<any>> {
    // 1. 토큰 검증
    const mergeRequest = await this.mergeService.validateToken(token);

    // 2. Saga 실행
    const result = await this.orchestrator.execute(mergeRequest);

    return ApiResponse.success({
      mergeRequestId: mergeRequest.id,
      status: result.status,
      completedAt: result.completedAt,
      errorMessage: result.errorMessage,
    });
  }

  @Get('status/:mergeRequestId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '병합 상태 조회' })
  async getStatus(
    @CurrentUser() user: { id: string },
    @Param('mergeRequestId') id: string
  ): Promise<ApiResponse<MergeStatusResponse>> {
    const status = await this.mergeService.getStatus(id, user.id);
    return ApiResponse.success(status);
  }

  @Delete(':mergeRequestId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '병합 요청 취소 (진행 전 상태만 가능)' })
  async cancelMerge(
    @CurrentUser() user: { id: string },
    @Param('mergeRequestId') id: string
  ): Promise<ApiResponse<void>> {
    await this.mergeService.cancel(id, user.id);
    return ApiResponse.success(null, '병합 요청이 취소되었습니다');
  }
}
```

**DTO 정의**:

파일: `auth-server/src/modules/oauth/dto/merge.dto.ts`
```typescript
import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OAuthAccountProviderType } from '@krgeobuk/oauth/enum';

export class RequestMergeDto {
  @ApiProperty({ enum: OAuthAccountProviderType })
  @IsEnum(OAuthAccountProviderType)
  provider!: OAuthAccountProviderType;

  @ApiProperty()
  @IsString()
  providerId!: string;
}

export interface MergeStatusResponse {
  id: string;
  status: string;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}
```

#### 5-2. AccountMergeService 구현

**생성할 파일**: `auth-server/src/modules/oauth/account-merge.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuid } from 'uuid';
import { AccountMergeRequestEntity } from './entities/account-merge-request.entity';
import { UserService } from '../user/user.service';
import { OAuthService } from './oauth.service';
import { EmailService } from '@krgeobuk/email/services';
import { RedisService } from '../../database/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { OAuthAccountProviderType, AccountMergeStatus } from '@krgeobuk/oauth/enum';
import { OAuthException } from '@krgeobuk/oauth/exception';

@Injectable()
export class AccountMergeService {
  private readonly logger = new Logger(AccountMergeService.name);

  constructor(
    @InjectRepository(AccountMergeRequestEntity)
    private readonly mergeRequestRepository: Repository<AccountMergeRequestEntity>,
    private readonly userService: UserService,
    private readonly oauthService: OAuthService,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService
  ) {}

  async createMergeRequest(
    targetUserId: string,
    provider: OAuthAccountProviderType,
    providerId: string
  ): Promise<{ id: string; targetUserId: string; sourceUserEmail: string }> {
    // 1. Source user 조회 (OAuth 계정 소유자)
    const existingOAuth = await this.oauthService.findByProviderAndId(provider, providerId);

    if (!existingOAuth) {
      throw OAuthException.providerNotLinked(provider);
    }

    const sourceUserId = existingOAuth.userId;
    const sourceUser = await this.userService.findById(sourceUserId);

    // 2. 병합 요청 엔티티 생성
    const mergeRequest = this.mergeRequestRepository.create({
      targetUserId,
      sourceUserId,
      provider,
      providerId,
      status: AccountMergeStatus.PENDING_EMAIL_VERIFICATION,
    });

    await this.mergeRequestRepository.save(mergeRequest);

    // 3. 토큰 생성 및 Redis 저장
    const token = uuid();
    await this.redisService.setExValue(
      `merge:token:${token}`,
      86400, // 24시간
      JSON.stringify({ mergeRequestId: mergeRequest.id, sourceUserId, targetUserId })
    );

    // 4. 확인 이메일 발송
    const confirmUrl = `${this.configService.get('client.baseUrl')}/oauth/merge/confirm?token=${token}`;

    await this.emailService.sendAccountMergeEmail({
      to: sourceUser.email,
      name: sourceUser.name,
      targetUserEmail: (await this.userService.findById(targetUserId)).email,
      provider: provider.toUpperCase(),
      providerId,
      confirmUrl,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString('ko-KR'),
    });

    this.logger.log('Merge request created', { mergeRequestId: mergeRequest.id });

    return {
      id: mergeRequest.id,
      targetUserId,
      sourceUserEmail: sourceUser.email,
    };
  }

  async validateToken(token: string): Promise<AccountMergeRequestEntity> {
    // 1. Redis에서 토큰 검증
    const tokenData = await this.redisService.getValue(`merge:token:${token}`);

    if (!tokenData) {
      throw OAuthException.invalidOrExpiredMergeToken();
    }

    const { mergeRequestId } = JSON.parse(tokenData);

    // 2. 병합 요청 조회
    const mergeRequest = await this.mergeRequestRepository.findOne({
      where: { id: mergeRequestId },
    });

    if (!mergeRequest) {
      throw OAuthException.mergeRequestNotFound();
    }

    // 3. 상태 확인
    if (mergeRequest.status !== AccountMergeStatus.PENDING_EMAIL_VERIFICATION) {
      throw OAuthException.mergeRequestAlreadyProcessed();
    }

    // 4. 상태 업데이트
    mergeRequest.status = AccountMergeStatus.EMAIL_VERIFIED;
    mergeRequest.emailVerifiedAt = new Date();
    await this.mergeRequestRepository.save(mergeRequest);

    // 5. 토큰 삭제 (일회용)
    await this.redisService.deleteValue(`merge:token:${token}`);

    return mergeRequest;
  }

  async getStatus(mergeRequestId: string, userId: string): Promise<any> {
    const mergeRequest = await this.mergeRequestRepository.findOne({
      where: { id: mergeRequestId },
    });

    if (!mergeRequest) {
      throw OAuthException.mergeRequestNotFound();
    }

    // 권한 확인 (targetUser 또는 sourceUser만 조회 가능)
    if (mergeRequest.targetUserId !== userId && mergeRequest.sourceUserId !== userId) {
      throw OAuthException.unauthorized();
    }

    return {
      id: mergeRequest.id,
      status: mergeRequest.status,
      retryCount: mergeRequest.retryCount,
      errorMessage: mergeRequest.errorMessage,
      createdAt: mergeRequest.createdAt.toISOString(),
      completedAt: mergeRequest.completedAt?.toISOString() || null,
    };
  }

  async cancel(mergeRequestId: string, userId: string): Promise<void> {
    const mergeRequest = await this.mergeRequestRepository.findOne({
      where: { id: mergeRequestId },
    });

    if (!mergeRequest) {
      throw OAuthException.mergeRequestNotFound();
    }

    // 권한 확인
    if (mergeRequest.targetUserId !== userId) {
      throw OAuthException.unauthorized();
    }

    // 취소 가능 상태 확인
    if (
      mergeRequest.status !== AccountMergeStatus.PENDING_EMAIL_VERIFICATION &&
      mergeRequest.status !== AccountMergeStatus.EMAIL_VERIFIED
    ) {
      throw OAuthException.cannotCancelMerge();
    }

    mergeRequest.status = AccountMergeStatus.CANCELLED;
    await this.mergeRequestRepository.save(mergeRequest);
  }
}
```

#### 5-3. Module 등록

**수정할 파일**: `auth-server/src/modules/oauth/oauth.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([OAuthAccountEntity, AccountMergeRequestEntity]), // 엔티티 추가
    HttpModule,
    UserModule,
    JwtModule,
    EmailModule,
    ClientsModule.registerAsync([
      {
        name: 'AUTHZ_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get('client.authzServiceHost'),
            port: configService.get('client.authzServicePort'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'MYPICK_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get('client.myPickServiceHost'),
            port: configService.get('client.myPickServicePort'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [
    OAuthController,
    OAuthAccountController,
    OAuthMergeController, // 신규 컨트롤러
  ],
  providers: [
    OAuthService,
    GoogleOAuthService,
    NaverOAuthService,
    OAuthRepository,
    AccountMergeService,        // 신규 서비스
    AccountMergeOrchestrator,   // 신규 오케스트레이터
  ],
  exports: [OAuthService, AccountMergeService],
})
export class OAuthModule {}
```

#### 5-4. E2E 테스트

**생성할 파일**: `auth-server/src/modules/oauth/test/account-merge.e2e-spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

describe('Account Merge E2E', () => {
  let app: INestApplication;
  let accessToken: string;
  let mergeRequestId: string;
  let confirmToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // 테스트 사용자 로그인
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    accessToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('[POST] /oauth/account-merge/request - 병합 요청 생성', async () => {
    const response = await request(app.getHttpServer())
      .post('/oauth/account-merge/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        provider: 'GOOGLE',
        providerId: 'existing-google-id',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('mergeRequestId');
    expect(response.body.data).toHaveProperty('sourceUserEmail');

    mergeRequestId = response.body.data.mergeRequestId;
  });

  it('[GET] /oauth/account-merge/status/:id - 병합 상태 조회', async () => {
    const response = await request(app.getHttpServer())
      .get(`/oauth/account-merge/status/${mergeRequestId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data.status).toBe('PENDING_EMAIL_VERIFICATION');
  });

  it('[GET] /oauth/account-merge/confirm?token=xxx - 이메일 확인 후 병합 실행', async () => {
    // TODO: Redis에서 토큰 추출하여 테스트
    // const response = await request(app.getHttpServer())
    //   .get(`/oauth/account-merge/confirm?token=${confirmToken}`)
    //   .expect(200);
    //
    // expect(response.body.data.status).toBe('COMPLETED');
  });

  it('[DELETE] /oauth/account-merge/:id - 병합 요청 취소', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/oauth/account-merge/${mergeRequestId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

**완료 기준**:
- ✅ HTTP API 엔드포인트 4개 구현 완료
- ✅ Swagger 문서화 완료
- ✅ E2E 테스트 작성 및 통과
- ✅ 성능 테스트 (1초 이내 완료 검증)
- ✅ 보안 검토 (CSRF, rate limiting)

---

## 4. ✅ 결정 완료 및 승인 사항

> **승인일**: 2026-01-03
> **상태**: 모든 주요 결정 완료, 구현 즉시 시작 가능

### ✅ 결정 1: reports & report_review 테이블 처리

**결정**: **옵션 B - 병합 대상 제외**

**근거**:
- my-pick-server의 modules_backup은 현재 사용하지 않음으로 확인됨
- 핵심 기능(5개 테이블)에 집중하여 개발 기간 단축
- 필요 시 향후 수동 병합 가능

**영향**:
- 병합 대상 테이블: ~~7개~~ → **5개**로 감소
- 개발 복잡도 감소, 테스트 범위 축소
- 예상 개발 기간: 6-7주 유지 (복잡도 감소로 버퍼 증가)

---

### ✅ 결정 2: my-pick-server TCP 포트 번호

**결정**: **8310 사용**

**근거**:
- 일관된 포트 패턴 유지 (auth: 8010, authz: 8110)
- 네트워크 충돌 없음, 관리 용이성 향상

**적용 위치**:
```bash
# my-pick-server/envs/local.env
TCP_PORT=8310
```

**영향**:
- my-pick-server main.ts 수정 필요
- Docker Compose 설정 업데이트 필요
- 다른 서비스의 클라이언트 설정 업데이트

---

### ✅ 결정 3: 구현 방식

**결정**: **옵션 B - 단계별 순차 구현**

**근거**:
- 리스크 분산 및 조기 피드백 확보
- 각 단계별 검증을 통한 품질 향상

**실행 계획**:
1. **1단계 완료** → 공유 패키지 게시, 기반 검증
2. **2단계 완료** → 오케스트레이터 단위 테스트
3. **3단계 완료** → TCP 통신 통합 테스트
4. **4단계 완료** → 보상 트랜잭션 시나리오 테스트
5. **5단계 완료** → E2E 테스트, 베타 배포

**Feature Flag 전략**:
- 환경 변수: `ENABLE_ACCOUNT_MERGE=false` (기본값)
- 2-3단계 완료 후 프로덕션 배포 (기능 비활성화)
- 5단계 완료 후 내부 테스트 → 베타 → 전체 오픈

---

## 5. 예상 일정 및 리소스

### 5.1 상세 일정표

| 단계 | 주차 | 주요 작업 | 산출물 | 완료 기준 |
|-----|------|----------|--------|----------|
| **1단계** | 1주 | @krgeobuk/saga 패키지, 엔티티, 템플릿 | saga 패키지, account_merge_request, email 템플릿 | 패키지 빌드 성공, 엔티티 생성 |
| **2단계** | 2주 | Orchestrator 구현, OAuth service 수정 | AccountMergeOrchestrator, 수정된 linkOAuthAccount | 단위 테스트 통과 |
| **3단계** | 3주 | TCP 엔드포인트 (authz, my-pick), 병합 로직 | 4개 TCP 엔드포인트, UserMergeService | TCP 통신 테스트 통과 |
| **4단계** | 1주 | 보상 트랜잭션, 롤백 로직, 관리자 기능 | 완전한 보상 로직, 관리자 복구 API | 롤백 시나리오 테스트 통과 |
| **5단계** | 1주 | HTTP API, E2E 테스트, 문서화 | 4개 HTTP 엔드포인트, E2E 테스트, Swagger | E2E 테스트 통과, 성능 검증 |
| **통합** | 1주 | 통합 테스트, 성능 테스트, 보안 검토 | 통합 테스트 스위트, 성능 리포트 | 전체 시나리오 통과 |

**총 예상 기간**: **6-7주** (통합 테스트 포함)

### 5.2 리소스 요구사항

**개발 인력**:
- Backend 개발자 1명 (full-time)
- 선택적: Frontend 개발자 0.5명 (에러 처리 UI)

**인프라**:
- Verdaccio 레지스트리 (로컬 개발용)
- SMTP 서버 (이메일 발송)
- Redis (토큰 및 스냅샷 저장)

**테스트 환경**:
- 로컬 개발 환경
- 스테이징 환경 (통합 테스트)
- 프로덕션 환경 (베타 테스트)

---

## 6. 핵심 리스크 및 완화 전략

| 리스크 | 가능성 | 영향 | 완화 전략 |
|--------|--------|------|----------|
| **UNIQUE 제약조건 충돌** | 높음 | 높음 | • "User A 우선" 전략 명확화<br>• 트랜잭션 보장<br>• 충분한 단위 테스트 |
| **TCP 타임아웃** | 중간 | 중간 | • 스마트 재시도 (3회)<br>• Exponential backoff<br>• 타임아웃 모니터링 |
| **보상 트랜잭션 실패** | 낮음 | 높음 | • Redis 스냅샷 7일 보관<br>• 관리자 복구 기능<br>• 실패 시 즉시 알림 |
| **my-pick-server TCP 활성화 영향** | 낮음 | 중간 | • 별도 포트 사용 (8310)<br>• 점진적 배포<br>• 모니터링 강화 |
| **이메일 발송 실패** | 중간 | 중간 | • SMTP 재시도 로직<br>• 실패 시 사용자 알림<br>• 수동 재발송 기능 |
| **데이터 손실** | 낮음 | 높음 | • 7일 스냅샷 백업<br>• 소프트 삭제 사용<br>• 감사 로그 |

### 6.1 성공률 목표

**원 계획 목표** (ACCOUNT_MERGE_PLAN.md):
- 재시도 없음: 95% 성공률
- 스마트 재시도: **99.8% 성공률**

**프로젝트 목표**:
- Phase 1 (베타 테스트): **99.5% 성공률**
- Phase 2 (전체 배포): **99.8% 성공률**

---

## 7. 다음 단계

### 7.1 즉시 결정 필요

다음 항목에 대한 사용자 승인이 필요합니다:

1. **✅ 전체 구현 계획 승인**
   - 5단계 구현 계획 동의 여부

2. **❓ reports/report_review 처리 방향**
   - 옵션 A: 병합 대상 포함
   - 옵션 B: 병합 대상 제외 (권장)
   - 결정 방법: `my-pick-server` 데이터베이스 확인

3. **❓ my-pick-server TCP 포트 번호**
   - 권장: 8310
   - 대안: 다른 포트 지정

4. **❓ 구현 방식**
   - 옵션 A: 전체 구현 후 배포
   - 옵션 B: 단계별 점진적 배포 (권장)

### 7.2 승인 후 작업 흐름

**승인 즉시**:
1. @krgeobuk/saga 패키지 생성 시작
2. my-pick-server TCP 포트 환경 변수 설정
3. reports/report_review 결정 반영

**1주차 목표**:
- @krgeobuk/saga 패키지 완성
- account_merge_request 엔티티 생성
- account-merge.hbs 템플릿 생성
- Verdaccio 게시 완료

**점진적 진행**:
- 각 단계 완료 시 리뷰 및 피드백
- 테스트 통과 확인 후 다음 단계 진행
- 주간 진행 상황 보고

---

## 📌 요약

이 계획서는 기존 `ACCOUNT_MERGE_PLAN.md`를 현재 krgeobuk 프로젝트 상태에 맞게 조정한 **실행 가능한 구현 계획**입니다.

**핵심 포인트**:
- ✅ 준비된 인프라 최대 활용 (Email, Redis, TCP 패턴)
- ❌ 신규 구현 필요 항목 명확화 (@krgeobuk/saga, 엔티티, TCP 엔드포인트)
- ⚠️ 중요 적응 사항 식별 (TCP 서버 활성화, UNIQUE 제약조건 처리)
- 📋 5단계 상세 구현 가이드 제공
- ❓ 사용자 결정 필요 항목 명시
- 📊 6-7주 예상 일정 및 리소스 계획
- 🎯 99.8% 성공률 목표

**승인 대기 중**:
- reports/report_review 처리 방향
- my-pick-server TCP 포트 번호
- 구현 방식 (전체 vs 단계별)

승인 후 즉시 1단계 구현을 시작할 수 있습니다.
