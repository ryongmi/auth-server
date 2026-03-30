# YouTube OAuth 토큰 관리 구현 계획

## 📌 개요

auth-server를 **인증 + OAuth 토큰 저장소**로 확장하여, mypick-server가 사용자별 YouTube API를 호출할 수 있도록 구현합니다.

### 핵심 원칙
- ✅ **auth-server**: 인증 + OAuth 토큰 저장소 역할 (YouTube API 프록시는 하지 않음)
- ✅ **mypick-server**: YouTube 비즈니스 로직 소유, auth-server에서 토큰만 조회
- ✅ **Kubernetes 환경**: 내부 네트워크(ClusterIP)로 안전한 토큰 전달
- ✅ **확장성**: 향후 Twitter, Instagram API도 동일 패턴 적용 가능

---

## 🏗 아키텍처 구조

### Kubernetes 네트워크 구조
```
External (인터넷)
  ↓ Ingress (HTTPS)
  ↓
Internal Cluster Network (private, encrypted)
  ├─ auth-server:8000 (HTTP API)
  ├─ auth-server:8010 (TCP) ← mypick-server가 토큰 조회
  ├─ mypick-server:4000 (HTTP API)
  └─ YouTube API (외부)
```

### 데이터 흐름
```
1. 사용자 Google OAuth 로그인
   ↓
2. auth-server: YouTube 스코프 포함하여 OAuth 토큰 획득
   ↓
3. auth-server: 토큰 암호화하여 DB 저장
   ↓
4. mypick-server: 사용자가 댓글 작성 요청
   ↓
5. mypick-server → auth-server (TCP): "userId의 YouTube 토큰 줘"
   ↓
6. auth-server: 토큰 복호화 후 반환 (만료 시 자동 갱신)
   ↓
7. mypick-server: YouTube API 직접 호출 (댓글 작성)
   ↓
8. YouTube API: 실제 댓글 작성
```

---

## ✅ 구현 진행 현황

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | auth-server - OAuth 토큰 저장 기능 | ✅ 완료 |
| Phase 2 | auth-server - TCP 토큰 조회 API | ✅ 완료 |
| Phase 3 | 환경 변수 설정 | ✅ 완료 |
| Phase 4 | mypick-server 연동 | ⏳ 미진행 |
| Phase 5 | Kubernetes 배포 | ⏳ 미진행 |

---

## ✅ Phase 1: auth-server - OAuth 토큰 저장 기능 (완료)

### 1.1 CryptoModule (암호화 서비스)

> 초기 계획에서 `EncryptionService`로 설계했으나, 범용성을 위해 `CryptoModule`로 구현.
> 비밀번호 해싱(hash/verify)과 토큰 암호화(encrypt/decrypt)를 모두 지원.

**구현 파일:**
- `src/common/crypto/crypto.module.ts`
- `src/common/crypto/crypto.service.ts`

**주요 기능:**
```typescript
// CryptoService 메서드
hash(plainText: string): string              // 비밀번호 해싱 (scrypt, salt 16바이트)
verify(plainText: string, hashed: string): boolean  // 비밀번호 검증
encrypt(plainText: string): string           // AES-256-CBC 암호화 (토큰 저장용)
decrypt(encryptedText: string): string       // AES-256-CBC 복호화 (토큰 조회용)
```

**보안 사항:**
- 암호화 키: `ENCRYPTION_KEY` 환경변수 (32자 이상)
- 암호화 솔트: `ENCRYPTION_SALT` 환경변수 (고정 솔트 대신 환경변수 사용)
- scrypt로 키 유도, IV는 매 암호화마다 randomBytes(16) 생성

### 1.2 OAuthAccountEntity 확장

**파일:** `src/modules/oauth/entities/oauth-account.entity.ts`

```typescript
@Column({ type: 'text', nullable: true })
accessToken?: string | null;     // OAuth access token (AES-256-CBC 암호화)

@Column({ type: 'text', nullable: true })
refreshToken?: string | null;    // OAuth refresh token (AES-256-CBC 암호화)

@Column({ type: 'timestamp', nullable: true })
tokenExpiresAt?: Date | null;    // Access token 만료 시간

@Column({ type: 'varchar', length: 500, nullable: true })
scopes?: string | null;          // OAuth 권한 범위
```

### 1.3 Google OAuth 스코프 확장

**파일:** `src/modules/oauth/oauth.controller.ts`

`loginGoogle()`, `linkGoogle()` 모두 동일하게 적용:
```
scope=email profile https://www.googleapis.com/auth/youtube.force-ssl
access_type=offline       // refresh_token 획득
prompt=consent            // 매번 동의 화면 (refresh_token 보장)
```

### 1.4 토큰 저장 플로우

토큰 저장은 `OAuthTokenService.buildTokenAttributes()`를 통해 일괄 처리:

```
Google OAuth 콜백
  ↓
OAuthAuthenticationService.authenticate()
  ↓ getUserInfo() → tokenData (accessToken, refreshToken, expiresIn, scope)
  ↓
  ├─ LOGIN 모드 → OAuthUserService.authenticateOAuthUser()
  │   ├─ 기존 사용자: buildTokenAttributes() → Object.assign → updateOAuthAccount()
  │   └─ 신규 사용자: buildTokenAttributes() → createOAuthAccount()
  │
  └─ LINK 모드 → OAuthLinkageService.linkOAuthAccount()
      └─ buildTokenAttributes() → createOAuthAccount()
```

**OAuthTokenService.buildTokenAttributes():**
```typescript
buildTokenAttributes(tokenData) {
  return {
    accessToken: this.cryptoService.encrypt(tokenData.accessToken),
    refreshToken: tokenData.refreshToken
      ? this.cryptoService.encrypt(tokenData.refreshToken)
      : null,
    tokenExpiresAt: tokenData.expiresIn
      ? new Date(Date.now() + tokenData.expiresIn * 1000)
      : null,
    scopes: 'scope' in tokenData ? tokenData.scope : null,
  };
}
```

### 1.5 환경 변수

**파일:** `src/config/validation.schema.ts`, `src/config/encryption.ts`

```bash
ENCRYPTION_KEY=<32자 이상 랜덤 문자열>
ENCRYPTION_SALT=<16자 이상 랜덤 문자열>
```

Config 모듈의 validation schema에서 필수값 검증.

---

## ✅ Phase 2: auth-server - TCP 토큰 조회 API (완료)

> 초기 계획에서 `OAuthTokenTcpService`를 별도 생성하려 했으나,
> 기존 `OAuthTokenService`를 확장하는 방식으로 변경 (불필요한 레이어 제거).

### 2.1 OAuthTokenService 확장

**파일:** `src/modules/oauth/oauth-token.service.ts`

```typescript
// YouTube 토큰 조회 (자동 갱신 포함)
async getYouTubeAccessToken(userId: string): Promise<TcpYouTubeTokenResult>

// YouTube 권한 여부 확인
async hasYouTubeAccess(userId: string): Promise<boolean>

// Google OAuth 토큰 갱신 (private)
private async refreshGoogleToken(oauth: OAuthAccountEntity): Promise<void>
```

**토큰 자동 갱신 로직:**
- 만료 5분 전 자동 갱신 (expiryBuffer)
- Google `oauth2.googleapis.com/token` 엔드포인트 호출
- `GoogleTokenResponseDto`로 응답 변환 + 유효성 검사
- 갱신된 토큰 암호화 후 DB 저장

**에러 처리 (공통패키지 OAuthException 사용):**
- `OAuthException.tokenNotFound(provider)` - 토큰 없음 (OAUTH_110, 401)
- `OAuthException.refreshTokenNotFound(provider)` - 리프레시 토큰 없음 (OAUTH_111, 401)
- `OAuthException.tokenRefreshFailed(provider)` - 토큰 갱신 실패 (OAUTH_112, 500)

### 2.2 OAuthTokenTcpController

**파일:** `src/modules/oauth/oauth-token-tcp.controller.ts`

```typescript
@MessagePattern(OAuthTcpPatterns.YOUTUBE_GET_ACCESS_TOKEN)
async getYouTubeAccessToken(@Payload() data: TcpYouTubeTokenParams): Promise<TcpYouTubeTokenResult>

@MessagePattern(OAuthTcpPatterns.YOUTUBE_HAS_ACCESS)
async hasYouTubeAccess(@Payload() data: TcpYouTubeTokenParams): Promise<boolean>
```

에러 처리: `user-tcp.controller.ts` 패턴과 동일하게 throw error 방식 사용.

### 2.3 공통 패키지 (@krgeobuk/oauth)

**TCP 패턴** (`shared-lib/packages/oauth/src/tcp/patterns/patterns.ts`):
```typescript
export const OAuthTcpPatterns = {
  YOUTUBE_GET_ACCESS_TOKEN: 'oauth.youtube.get-access-token',
  YOUTUBE_HAS_ACCESS: 'oauth.youtube.has-access',
} as const;
```

**TCP 인터페이스** (`shared-lib/packages/oauth/src/tcp/interfaces/tcp-requests.interface.ts`):
```typescript
export interface TcpYouTubeTokenParams {
  userId: string;
}

export interface TcpYouTubeTokenResult {
  accessToken: string;
  expiresAt: Date;
}
```

**Exception 추가** (`shared-lib/packages/oauth/src/exception/`):
| 코드 | 메서드 | 메시지 | HTTP |
|------|--------|--------|------|
| OAUTH_110 | `tokenNotFound(provider)` | 액세스 토큰이 존재하지 않습니다 | 401 |
| OAUTH_111 | `refreshTokenNotFound(provider)` | 리프레시 토큰이 없어 토큰을 갱신할 수 없습니다 | 401 |
| OAUTH_112 | `tokenRefreshFailed(provider)` | 토큰 갱신에 실패했습니다 | 500 |

**package.json exports 추가:**
```json
"./tcp": "./dist/tcp/index.js",
"./tcp/interfaces": "./dist/tcp/interfaces/index.js",
"./tcp/patterns": "./dist/tcp/patterns/index.js"
```

### 2.4 OAuthModule 업데이트

**파일:** `src/modules/oauth/oauth.module.ts`
- `OAuthTokenTcpController` controllers에 추가
- `OAuthTokenService` exports에 추가

---

## ✅ Phase 3: 환경 변수 설정 (완료)

```bash
# 토큰 암호화
ENCRYPTION_KEY=<32자 이상 랜덤 문자열>
ENCRYPTION_SALT=<16자 이상 랜덤 문자열>
```

- `src/config/validation.schema.ts`에서 필수값 검증
- `src/config/encryption.ts`에서 ConfigModule에 등록
- `src/common/interfaces/config.interfaces.ts`에 `EncryptionConfig` 인터페이스 정의

---

## ⏳ Phase 4: mypick-server 연동 (미진행)

> 이 Phase부터 추후 진행 예정입니다.

### 4.1 사전 준비

1. **auth-server TCP 연결 설정** - mypick-server에서 AUTH_SERVICE ClientProxy 등록
2. **공통 패키지 설치** - `@krgeobuk/oauth` 패키지 최신 버전 설치 (TCP 패턴/인터페이스 포함)

### 4.2 mypick-server 모듈 설정

```typescript
// app.module.ts 또는 해당 feature module
import { ClientsModule, Transport } from '@nestjs/microservices';

ClientsModule.register([{
  name: 'AUTH_SERVICE',
  transport: Transport.TCP,
  options: {
    host: 'auth-server',  // Docker/K8s 네트워크
    port: 8010,
  },
}])
```

### 4.3 YouTube 토큰 조회 서비스

auth-server의 TCP API를 호출하여 YouTube 토큰을 조회하는 서비스 구현:

```typescript
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

import { OAuthTcpPatterns } from '@krgeobuk/oauth/tcp/patterns';
import type { TcpYouTubeTokenParams, TcpYouTubeTokenResult } from '@krgeobuk/oauth/tcp/interfaces';

// 토큰 조회
const token = await lastValueFrom(
  this.authClient.send<TcpYouTubeTokenResult, TcpYouTubeTokenParams>(
    OAuthTcpPatterns.YOUTUBE_GET_ACCESS_TOKEN,
    { userId }
  )
);
// token.accessToken, token.expiresAt 사용

// 권한 여부 확인
const hasAccess = await lastValueFrom(
  this.authClient.send<boolean, TcpYouTubeTokenParams>(
    OAuthTcpPatterns.YOUTUBE_HAS_ACCESS,
    { userId }
  )
);
```

### 4.4 YouTubeApiService 확장

**파일:** `mypick-server/src/modules/external-api/services/youtube-api.service.ts`

기존 읽기 전용 API (공유 API 키 사용)에 쓰기 작업 추가:

| 메서드 | 설명 | YouTube API | 할당량 |
|--------|------|-------------|--------|
| `insertComment(userId, videoId, text)` | 댓글 작성 | `commentThreads.insert` | 50 |
| `likeVideo(userId, videoId)` | 좋아요 추가 | `videos.rate` | 50 |
| `subscribeToChannel(userId, channelId)` | 채널 구독 | `subscriptions.insert` | 50 |

쓰기 작업은 개인 OAuth 토큰 사용 (`Authorization: Bearer {accessToken}`).

### 4.5 ContentController 엔드포인트 추가

| 엔드포인트 | 설명 | 인증 |
|-----------|------|------|
| `POST /content/:id/youtube-comment` | YouTube 댓글 작성 | AuthGuard |
| `POST /content/:id/youtube-like` | YouTube 좋아요 | AuthGuard |

### 4.6 에러 처리

auth-server TCP 응답에서 발생할 수 있는 에러:
- `OAUTH_110` (TOKEN_NOT_FOUND) → 사용자에게 Google 재로그인 안내
- `OAUTH_111` (REFRESH_TOKEN_NOT_FOUND) → 사용자에게 Google 재로그인 안내
- `OAUTH_112` (TOKEN_REFRESH_FAILED) → 서버 에러, 재시도 또는 재로그인 안내

---

## ⏳ Phase 5: Kubernetes 배포 (미진행)

### Service 정의 (내부 통신)

```yaml
# k8s/auth-server-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-server
  namespace: krgeobuk
spec:
  selector:
    app: auth-server
  ports:
    - name: http
      port: 8000
      targetPort: 8000
    - name: tcp
      port: 8010           # mypick-server가 OAuth 토큰 조회에 사용
      targetPort: 8010
  type: ClusterIP            # 클러스터 내부 전용
```

### Secret 관리

```yaml
# k8s/auth-server-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-server-secrets
  namespace: krgeobuk
type: Opaque
stringData:
  ENCRYPTION_KEY: "<32자 이상>"
  ENCRYPTION_SALT: "<16자 이상>"
  GOOGLE_CLIENT_SECRET: "<Google OAuth 시크릿>"
```

### NetworkPolicy (선택적 보안 강화)

```yaml
# k8s/auth-server-network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: auth-server-tcp-policy
  namespace: krgeobuk
spec:
  podSelector:
    matchLabels:
      app: auth-server
  policyTypes:
    - Ingress
  ingress:
    - from:
      - podSelector:
          matchLabels:
            app: mypick-server
      ports:
        - protocol: TCP
          port: 8010
    - from:
      - namespaceSelector:
          matchLabels:
            name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8000
```

---

## 🔒 보안 고려사항

### 1. 토큰 암호화
- ✅ AES-256-CBC 알고리즘 사용
- ✅ 환경 변수로 암호화 키/솔트 관리 (Git 제외)
- ✅ scrypt 키 유도 함수 적용
- ✅ IV는 매 암호화마다 randomBytes(16) 생성

### 2. 네트워크 보안
- ✅ ClusterIP로 내부 통신만 허용
- ✅ NetworkPolicy로 접근 제어 (mypick-server만 TCP 접근)

### 3. 토큰 관리
- ✅ 만료 5분 전 자동 갱신
- ✅ Refresh Token 암호화 저장
- ✅ 토큰 조회 시 복호화 (메모리에서만 존재)

### 4. 감사 로그
- ✅ 모든 토큰 조회/갱신 로깅
- ✅ 실패 케이스 상세 로깅

---

## 📊 예상 할당량 사용량

### 읽기 작업 (공유 API 키)
- 채널 정보 조회: 1 할당량
- 채널 영상 목록: 2 할당량 (playlist + videos)
- 영상 상세 조회: 1 할당량

### 쓰기 작업 (개인 OAuth 토큰)
- 댓글 작성: 50 할당량
- 좋아요: 50 할당량
- 구독: 50 할당량

### 예시 계산
- 사용자 1명이 댓글 10개 작성: 500 할당량
- 공유 키 방식: 전체 서비스 10,000 할당량 → 20명만 가능
- 개인 토큰 방식: 사용자별 10,000 할당량 → 무제한 확장 가능

---

## 📞 문제 해결 가이드

### 토큰 조회 실패 (`OAUTH_110` TOKEN_NOT_FOUND)
**원인**: 사용자가 Google 로그인을 하지 않았거나, OAuth 토큰이 저장되지 않음
**해결**: 사용자에게 다시 Google 로그인 요청

### 리프레시 토큰 없음 (`OAUTH_111` REFRESH_TOKEN_NOT_FOUND)
**원인**: Refresh Token이 저장되지 않음 (Google에서 발급하지 않은 경우)
**해결**: `prompt=consent`로 다시 로그인하면 refresh_token 재발급

### 토큰 갱신 실패 (`OAUTH_112` TOKEN_REFRESH_FAILED)
**원인**: Refresh Token이 만료되었거나 Google에서 토큰 폐기됨
**해결**: 사용자에게 다시 Google 로그인 요청

### YouTube API 호출 실패 (403 Forbidden)
**원인**: YouTube API 스코프가 없거나, 할당량 초과
**해결**:
1. `scopes` 필드 확인 (`youtube.force-ssl` 포함 여부)
2. Google Cloud Console에서 할당량 확인
3. 필요 시 할당량 증가 요청

### 암호화 키 오류
**원인**: `ENCRYPTION_KEY` 또는 `ENCRYPTION_SALT`가 설정되지 않음
**해결**: `.env` 파일에 `ENCRYPTION_KEY`(32자 이상), `ENCRYPTION_SALT`(16자 이상) 설정

---

## 🔗 참고 문서

- [YouTube Data API v3 - OAuth 2.0](https://developers.google.com/youtube/v3/guides/authentication)
- [Google OAuth 2.0 - Refresh Token](https://developers.google.com/identity/protocols/oauth2/web-server#offline)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/)

---

## 📁 구현된 파일 목록

### auth-server
| 파일 | 상태 | 설명 |
|------|------|------|
| `src/common/crypto/crypto.module.ts` | 신규 | CryptoModule (암호화 모듈) |
| `src/common/crypto/crypto.service.ts` | 신규 | hash/verify + encrypt/decrypt |
| `src/modules/oauth/entities/oauth-account.entity.ts` | 수정 | 토큰 필드 추가 |
| `src/modules/oauth/oauth.controller.ts` | 수정 | YouTube 스코프, offline access |
| `src/modules/oauth/oauth-token.service.ts` | 수정 | 토큰 빌드/조회/갱신 메서드 |
| `src/modules/oauth/oauth-token-tcp.controller.ts` | 신규 | TCP 컨트롤러 |
| `src/modules/oauth/oauth-user.service.ts` | 수정 | 토큰 저장 연동 |
| `src/modules/oauth/oauth-linkage.service.ts` | 수정 | 계정 연동 시 토큰 저장 |
| `src/modules/oauth/oauth.module.ts` | 수정 | TCP 컨트롤러/서비스 등록 |
| `src/config/validation.schema.ts` | 수정 | ENCRYPTION_KEY/SALT 검증 |
| `src/config/encryption.ts` | 신규 | 암호화 config 등록 |
| `src/common/interfaces/config.interfaces.ts` | 수정 | EncryptionConfig 추가 |

### shared-lib/packages/oauth
| 파일 | 상태 | 설명 |
|------|------|------|
| `src/tcp/patterns/patterns.ts` | 수정 | YouTube TCP 메시지 패턴 |
| `src/tcp/interfaces/tcp-requests.interface.ts` | 수정 | TCP 요청/응답 인터페이스 |
| `src/codes/oauth.constant.ts` | 수정 | OAUTH_110~112 에러 코드 |
| `src/messages/oauth.message.ts` | 수정 | 토큰 에러 메시지 |
| `src/exception/oauth.error.ts` | 수정 | 토큰 에러 정의 |
| `src/exception/oauth.exception.ts` | 수정 | 토큰 Exception 메서드 |
| `package.json` | 수정 | tcp exports 추가 |

---

**작성일**: 2025-11-11
**최종 수정일**: 2026-01-26
**작성자**: Claude Code
**버전**: 2.0
**상태**: Phase 1~3 완료, Phase 4~5 미진행
