# 리팩토링 노트 - Common Email Module

## 개요
이메일 인증(EmailVerification)과 비밀번호 재설정(PasswordReset)의 중복 코드를 제거하기 위해 `CommonEmailModule`을 생성했습니다.

## 변경 사항

### 1. 생성된 파일
- `src/common/email/email-token.service.ts` - 이메일 토큰 생성/발송 통합 서비스
- `src/common/email/email.module.ts` - 공통 이메일 모듈
- `src/common/email/index.ts` - Barrel export

### 2. 리팩토링된 서비스

#### EmailVerificationService
- **Before**: 130 lines (토큰 생성, Redis 저장, 이메일 발송 로직 포함)
- **After**: 93 lines (-37 lines, 28% 감소)
- **변경**: `sendVerificationEmail()` 메서드를 `EmailTokenService.generateAndSendToken()` 호출로 대체

#### PasswordResetService
- **Before**: 118 lines (토큰 생성, Redis 저장, 이메일 발송 로직 포함)
- **After**: 85 lines (-33 lines, 28% 감소)
- **변경**: `sendPasswordResetEmail()` 메서드를 `EmailTokenService.generateAndSendToken()` 호출로 대체

### 3. 제거된 중복 코드
- UUID 토큰 생성 로직 (중복 제거)
- Redis 토큰 저장 로직 (중복 제거)
- 이메일 발송 try-catch 및 에러 처리 (중복 제거)
- 토큰 삭제 롤백 로직 (중복 제거)

**총 중복 코드 제거**: 약 70 lines

---

## 환경 변수 설정 필요

### ⚠️ 공유 라이브러리 업데이트 필요

`@krgeobuk/email` 패키지의 `EmailConfig` 인터페이스에 다음 설정을 추가해야 합니다:

```typescript
// shared-lib/packages/email/src/config/email.config.ts

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
  verification: {
    expiresIn: number;        // 기존
    baseUrl: string;          // 기존
  };
  passwordReset: {            // ✅ 추가 필요
    expiresIn: number;        // ✅ 추가 필요
  };
}

export default registerAs('email', (): EmailConfig => ({
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
  from: process.env.SMTP_FROM || 'krgeobuk <noreply@krgeobuk.com>',
  verification: {
    expiresIn: parseInt(process.env.EMAIL_VERIFICATION_EXPIRES_IN || '86400', 10),
    baseUrl: process.env.EMAIL_VERIFICATION_BASE_URL,
  },
  passwordReset: {  // ✅ 추가
    expiresIn: parseInt(process.env.PASSWORD_RESET_EXPIRES_IN || '3600', 10),
  },
}));
```

### 환경 변수 추가

`envs/.env.example` 및 실제 환경 파일에 다음 변수를 추가하세요:

```bash
# 이메일 인증 토큰 만료 시간 (초)
EMAIL_VERIFICATION_EXPIRES_IN=86400  # 24시간

# 비밀번호 재설정 토큰 만료 시간 (초)
PASSWORD_RESET_EXPIRES_IN=3600       # 1시간
```

---

## 하드코딩 제거 완료

### Before (하드코딩)
```typescript
// EmailVerificationService
const expiresIn = emailConfig?.verification?.expiresIn || 86400; // ❌ 하드코딩

// PasswordResetService
const expiresIn = 3600; // ❌ 하드코딩
```

### After (환경변수 기반)
```typescript
// EmailTokenService
const expiresIn = emailConfig?.verification?.expiresIn || 86400;        // ✅ 설정 기반
const expiresIn = emailConfig?.passwordReset?.expiresIn || 3600;  // ✅ 설정 기반
```

---

## 테스트 체크리스트

### 1. 이메일 인증 테스트
- [ ] 이메일 인증 요청 시 정상적으로 이메일 발송
- [ ] 토큰 만료 시간이 설정값대로 적용되는지 확인
- [ ] 이메일 발송 실패 시 Redis 토큰 롤백 확인

### 2. 비밀번호 재설정 테스트
- [ ] 비밀번호 재설정 요청 시 정상적으로 이메일 발송
- [ ] 토큰 만료 시간이 설정값대로 적용되는지 확인
- [ ] 이메일 발송 실패 시 Redis 토큰 롤백 확인

### 3. 설정 테스트
- [ ] `EMAIL_VERIFICATION_EXPIRES_IN` 환경변수 적용 확인
- [ ] `PASSWORD_RESET_EXPIRES_IN` 환경변수 적용 확인
- [ ] 환경변수 미설정 시 기본값 동작 확인

---

## 아키텍처 개선 효과

### Before
```
EmailVerificationService (130 lines)
├── 토큰 생성 (UUID)
├── Redis 저장
├── 이메일 발송
└── 에러 처리 + 롤백

PasswordResetService (118 lines)
├── 토큰 생성 (UUID)      ← 중복
├── Redis 저장             ← 중복
├── 이메일 발송            ← 중복
└── 에러 처리 + 롤백       ← 중복
```

### After
```
CommonEmailModule
└── EmailTokenService (통합)
    ├── 토큰 생성 (UUID)
    ├── Redis 저장
    ├── 이메일 발송
    └── 에러 처리 + 롤백

EmailVerificationService (93 lines) → EmailTokenService 사용
PasswordResetService (85 lines)     → EmailTokenService 사용
```

### 개선 지표
- **코드 중복 제거**: ~70 lines
- **EmailVerificationService**: 130 → 93 lines (-28%)
- **PasswordResetService**: 118 → 85 lines (-28%)
- **유지보수성**: 이메일 토큰 로직을 한 곳에서 관리
- **일관성**: 동일한 토큰 생성/처리 로직 보장
- **확장성**: 새로운 이메일 토큰 타입 추가 용이

---

## 다음 단계 권장

1. **공유 라이브러리 업데이트**
   - `@krgeobuk/email` 패키지에 `passwordReset.expiresIn` 설정 추가
   - 버전 업데이트 및 배포

2. **환경 변수 설정**
   - 모든 환경 파일에 `PASSWORD_RESET_EXPIRES_IN` 추가

3. **추가 리팩토링 고려**
   - OAuth State 관리도 유사한 패턴 적용 가능
   - Redis 키 관리를 별도 서비스로 분리 검토
