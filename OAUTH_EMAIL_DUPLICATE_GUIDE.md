# OAuth 이메일 중복 에러 처리 가이드

> **프론트엔드 개발자용**: OAuth 로그인 시 이메일 중복 에러 처리 방법

## 개요

OAuth 로그인(Google, Naver) 시 해당 이메일로 이미 가입된 계정이 있을 경우, 사용자에게 명확한 안내 메시지와 함께 기존 로그인 방법을 제시합니다.

## 에러 응답 형식

### HTTP 상태 코드
```
409 Conflict
```

### 응답 Body
```json
{
  "success": false,
  "error": {
    "code": "OAUTH_205",
    "message": "test@gmail.com은(는) 이미 가입된 계정입니다.",
    "details": {
      "email": "test@gmail.com",
      "attemptedProvider": "google",
      "availableLoginMethods": ["email"],
      "suggestion": "다음 방법으로 로그인 후 설정에서 Google 연동이 가능합니다."
    }
  }
}
```

### 응답 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `code` | string | 에러 코드 (`OAUTH_205` 고정) |
| `message` | string | 사용자에게 표시할 메인 메시지 |
| `details.email` | string | 중복된 이메일 주소 |
| `details.attemptedProvider` | string | 시도한 OAuth 제공자 (`google` \| `naver`) |
| `details.availableLoginMethods` | string[] | 사용 가능한 로그인 방법 목록 |
| `details.suggestion` | string | 사용자 안내 메시지 |

### availableLoginMethods 값

| 값 | 의미 |
|----|------|
| `"email"` | 이메일/비밀번호 로그인 가능 |
| `"google"` | Google OAuth 로그인 가능 |
| `"naver"` | Naver OAuth 로그인 가능 |

## 시나리오별 응답 예시

### 시나리오 1: 일반 회원가입 후 OAuth 시도

**상황**: test@gmail.com으로 이메일/비밀번호 회원가입 → Google OAuth 로그인 시도

```json
{
  "error": {
    "code": "OAUTH_205",
    "message": "test@gmail.com은(는) 이미 가입된 계정입니다.",
    "details": {
      "email": "test@gmail.com",
      "attemptedProvider": "google",
      "availableLoginMethods": ["email"],
      "suggestion": "다음 방법으로 로그인 후 설정에서 Google 연동이 가능합니다."
    }
  }
}
```

### 시나리오 2: 다른 OAuth로 가입 후 새 OAuth 시도

**상황**: test@naver.com으로 Naver OAuth 가입 → Google OAuth 로그인 시도 (같은 이메일)

```json
{
  "error": {
    "code": "OAUTH_205",
    "message": "test@naver.com은(는) 이미 가입된 계정입니다.",
    "details": {
      "email": "test@naver.com",
      "attemptedProvider": "google",
      "availableLoginMethods": ["naver"],
      "suggestion": "다음 방법으로 로그인 후 설정에서 Google 연동이 가능합니다."
    }
  }
}
```

### 시나리오 3: 이메일 + OAuth 혼합

**상황**: 이메일 가입 + Naver 연동 완료 → Google OAuth 시도

```json
{
  "error": {
    "code": "OAUTH_205",
    "message": "test@gmail.com은(는) 이미 가입된 계정입니다.",
    "details": {
      "email": "test@gmail.com",
      "attemptedProvider": "google",
      "availableLoginMethods": ["email", "naver"],
      "suggestion": "다음 방법으로 로그인 후 설정에서 Google 연동이 가능합니다."
    }
  }
}
```

## 프론트엔드 구현 예시

### TypeScript 인터페이스

```typescript
interface OAuthEmailDuplicateError {
  code: 'OAUTH_205';
  message: string;
  details: {
    email: string;
    attemptedProvider: 'google' | 'naver';
    availableLoginMethods: ('email' | 'google' | 'naver')[];
    suggestion: string;
  };
}
```

### 에러 처리 핸들러

```typescript
function handleOAuthError(error: ApiError) {
  if (error.code === 'OAUTH_205') {
    const { email, attemptedProvider, availableLoginMethods, suggestion } = error.details;

    showModal({
      title: '이미 가입된 이메일입니다',
      message: `${email}은(는) 이미 사용 중입니다.`,
      content: renderLoginMethodsGuide(availableLoginMethods, attemptedProvider),
      actions: [
        { label: '로그인하기', onClick: () => router.push('/login') },
        { label: '다른 이메일로 가입', onClick: () => handleRetry() },
      ],
    });
  }
}

function renderLoginMethodsGuide(
  methods: string[],
  attemptedProvider: string
): string {
  const methodNames = {
    email: '이메일/비밀번호',
    google: 'Google',
    naver: 'Naver',
  };

  const methodList = methods.map(m => `• ${methodNames[m]} 로그인`).join('\n  ');

  return `
💡 다음 방법으로 로그인하세요:
  ${methodList}

로그인 후 설정 > 계정 연동에서 ${methodNames[attemptedProvider]}을 연동할 수 있습니다.
  `.trim();
}
```

### React 컴포넌트 예시

```tsx
import { useState } from 'react';
import { useRouter } from 'next/router';

function OAuthErrorModal({ error }: { error: OAuthEmailDuplicateError }) {
  const router = useRouter();
  const { email, attemptedProvider, availableLoginMethods, suggestion } = error.details;

  const getMethodName = (method: string) => {
    const names = { email: '이메일/비밀번호', google: 'Google', naver: 'Naver' };
    return names[method] || method;
  };

  const getProviderName = (provider: string) => {
    const names = { google: 'Google', naver: 'Naver' };
    return names[provider] || provider;
  };

  return (
    <div className="modal">
      <h2>이미 가입된 이메일입니다</h2>
      <p className="email">{email}은(는) 이미 사용 중입니다.</p>

      <div className="guide">
        <p className="guide-title">💡 다음 방법으로 로그인하세요:</p>
        <ul>
          {availableLoginMethods.map((method) => (
            <li key={method}>{getMethodName(method)} 로그인</li>
          ))}
        </ul>
        <p className="suggestion">
          로그인 후 설정 &gt; 계정 연동에서 {getProviderName(attemptedProvider)}을 연동할 수
          있습니다.
        </p>
      </div>

      <div className="actions">
        <button onClick={() => router.push('/login')}>로그인하기</button>
        <button onClick={() => router.back()}>다른 이메일로 가입</button>
      </div>
    </div>
  );
}
```

## UI/UX 권장사항

### 1. 모달 디자인 예시

```
┌─────────────────────────────────────────┐
│  이미 가입된 이메일입니다                │
├─────────────────────────────────────────┤
│                                         │
│  test@gmail.com은(는) 이미 사용 중입니다.│
│                                         │
│  💡 다음 방법으로 로그인하세요:          │
│    • 이메일/비밀번호 로그인              │
│    • Naver 로그인                       │
│                                         │
│  로그인 후 설정 > 계정 연동에서          │
│  Google을 연동할 수 있습니다.            │
│                                         │
├─────────────────────────────────────────┤
│  [로그인하기]  [다른 이메일로 가입]      │
└─────────────────────────────────────────┘
```

### 2. 사용자 플로우

```
1. 사용자가 Google OAuth 버튼 클릭
   ↓
2. Google 인증 완료
   ↓
3. 서버에서 409 에러 반환
   ↓
4. 프론트엔드에서 모달 표시
   ↓
5. 사용자 선택:
   - [로그인하기] → /login 페이지로 이동
   - [다른 이메일로 가입] → OAuth 선택 화면으로 복귀
```

### 3. 스타일링 권장사항

- **이메일 강조**: 중복된 이메일은 볼드체 또는 하이라이트 표시
- **로그인 방법 아이콘**: 각 로그인 방법 옆에 아이콘 표시 (이메일, Google, Naver 로고)
- **주 액션 버튼**: "로그인하기"를 주 버튼(primary)으로 강조
- **모달 크기**: 모바일에서도 읽기 편한 크기로 조정
- **자동 닫기**: 로그인 성공 시 모달 자동 닫기

## 테스트 시나리오

### 1. 이메일 회원가입 → Google OAuth
```bash
1. POST /api/auth/signup (email: test@gmail.com, password: ...)
2. GET /api/oauth/login-google
3. 예상 결과: 409 에러 + availableLoginMethods: ["email"]
```

### 2. Naver OAuth → Google OAuth (같은 이메일)
```bash
1. GET /api/oauth/login-naver (email: test@naver.com)
2. GET /api/oauth/login-google (email: test@naver.com)
3. 예상 결과: 409 에러 + availableLoginMethods: ["naver"]
```

### 3. 이메일 가입 → Naver 연동 → Google OAuth 시도
```bash
1. POST /api/auth/signup (email: test@gmail.com)
2. POST /api/oauth/link (provider: naver)
3. GET /api/oauth/login-google
4. 예상 결과: 409 에러 + availableLoginMethods: ["email", "naver"]
```

## FAQ

### Q1. 에러 메시지를 커스터마이징할 수 있나요?
A1. 서버에서 제공하는 `message`와 `suggestion`을 기본으로 사용하되, 프론트엔드에서 UI에 맞게 재구성 가능합니다.

### Q2. `availableLoginMethods`가 빈 배열일 수 있나요?
A2. 정상적인 경우 빈 배열이 될 수 없습니다. 만약 빈 배열이면 "고객센터에 문의해주세요" 메시지가 `suggestion`에 포함됩니다.

### Q3. 모달 대신 페이지로 구현할 수 있나요?
A3. 네, UX 정책에 따라 전용 에러 페이지로 리다이렉트할 수도 있습니다.

### Q4. 에러 로깅은 어떻게 하나요?
A4. 409 에러는 정상적인 비즈니스 로직이므로, 에러 추적 도구(Sentry 등)에 보고하지 않는 것을 권장합니다.

## 관련 문서

- [OAuth 계정 연동 가이드](./OAUTH_ACCOUNT_LINKING_GUIDE.md)
- [계정 병합 기능 문서](./ACCOUNT_MERGE_PLAN.md)
- [API 에러 코드 목록](./API_ERROR_CODES.md)
