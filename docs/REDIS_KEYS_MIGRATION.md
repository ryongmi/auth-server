# Redis Keys 관리 개선 가이드

## 개요

Redis 키 관리를 **환경변수 방식**에서 **RedisService 중심 방식**(소스 코드 상수 + 환경변수 prefix + state별 전용 메서드)으로 개선했습니다.

### 주요 변경사항

| 변경 전 | 변경 후 |
|---------|---------|
| 개별 STORE_NAME 환경변수 관리 | 소스 코드 상수 + REDIS_KEY_PREFIX |
| `JWT_REFRESH_STORE_NAME=refreshToken` | `REDIS_KEY_PREFIX=` (선택사항) |
| `JWT_BLACKLIST_STORE_NAME=blacklist:` | 소스 코드에서 관리 |
| ConfigService로 직접 접근 | RedisService state 전용 메서드 사용 |
| 범용 메서드 public 노출 | 범용 메서드 private, state 전용 메서드 public |

### 장점

✅ **타입 안전성**: TypeScript 컴파일 타임 검증
✅ **캡슐화**: RedisService가 모든 Redis 작업 관리
✅ **명확한 API**: state별 전용 메서드로 의도 명확화
✅ **환경별 분리**: prefix로 dev/prod 격리
✅ **중앙 관리**: 모든 키를 한 곳에서 관리
✅ **실수 방지**: 키 생성 로직 중복 제거

---

## 파일 구조

```
src/
├── constants/
│   └── redis-keys.const.ts         # Redis 키 베이스 상수
├── config/
│   └── validation.schema.ts        # Joi 검증 (REDIS_KEY_PREFIX 추가)
└── database/redis/
    └── redis.service.ts             # ✨ 모든 Redis 로직 여기에
```

---

## 환경변수 변경

### .env 파일 수정

#### 제거된 환경변수

```bash
# ❌ 제거됨
OAUTH_REDIRECT_SESSION_STORE_NAME=redirectSession:
JWT_REFRESH_STORE_NAME=refreshToken
JWT_BLACKLIST_STORE_NAME=blacklist:
JWT_NAVER_STATE_STORE_NAME=naverState:
JWT_GOOGLE_STATE_STORE_NAME=googleState:
```

#### 추가된 환경변수

```bash
# ✅ 추가됨 (선택사항)
REDIS_KEY_PREFIX=

# 환경별 예시:
# 개발: REDIS_KEY_PREFIX=dev
# 스테이징: REDIS_KEY_PREFIX=staging
# 프로덕션: REDIS_KEY_PREFIX=prod 또는 REDIS_KEY_PREFIX=
```

### 환경별 설정 예시

```bash
# envs/.env.local (로컬 개발)
REDIS_KEY_PREFIX=

# envs/.env.development (개발 서버)
REDIS_KEY_PREFIX=dev

# envs/.env.staging (스테이징 서버)
REDIS_KEY_PREFIX=staging

# envs/.env.production (프로덕션 서버)
REDIS_KEY_PREFIX=prod
```

---

## 코드 마이그레이션

### 핵심 원칙

**RedisService = Single Source of Truth**
- 모든 Redis 작업은 RedisService를 통해서만 수행
- 외부에서는 state별 전용 메서드만 사용
- 키 생성 로직은 RedisService 내부에 캡슐화

### RedisService 구조

```typescript
// src/database/redis/redis.service.ts
import { REDIS_BASE_KEYS } from '@constants/redis-keys.const';

@Injectable()
export class RedisService {
  private readonly envPrefix = process.env.REDIS_KEY_PREFIX || '';

  // 키 생성 헬퍼 (private)
  private buildKey(baseKey: string, id?: string): string {
    const key = id ? `${baseKey}:${id}` : baseKey;
    return this.envPrefix ? `${this.envPrefix}:${key}` : key;
  }

  // 범용 메서드 (private)
  private async setExValue(...) { }
  private async getValue(...) { }
  private async deleteValue(...) { }

  // State 전용 메서드 (public)
  async setNaverState(stateId: string, data: string, ttl = 300) { }
  async getNaverState(stateId: string) { }
  async deleteNaverState(stateId: string) { }
}
```

### 1. OAuth State 관리

#### 변경 전 (범용 메서드 사용)

```typescript
// ❌ 변경 전
import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';

export class OAuthService {
  constructor(private redisService: RedisService) {}

  async saveState(type: OAuthAccountProviderType, stateId: string, data: string) {
    await this.redisService.setOAuthState(type, stateId, data, 600);
  }

  async validateState(type: OAuthAccountProviderType, stateId: string) {
    const data = await this.redisService.getOAuthState(type, stateId);
    if (!data) throw new Error('Invalid state');
    await this.redisService.deleteOAuthState(type, stateId);
    return data;
  }
}
```

#### 변경 후 (state 전용 메서드)

```typescript
// ✅ 변경 후
export class NaverOAuthService {
  constructor(private redisService: RedisService) {}

  async saveState(stateId: string, data: string) {
    await this.redisService.setNaverState(stateId, data, 600);
  }

  async validateState(stateId: string) {
    const data = await this.redisService.getNaverState(stateId);
    if (!data) throw new Error('Invalid state');
    await this.redisService.deleteNaverState(stateId);
    return data;
  }
}

export class GoogleOAuthService {
  constructor(private redisService: RedisService) {}

  async saveState(stateId: string, data: string) {
    await this.redisService.setGoogleState(stateId, data, 600);
  }

  async validateState(stateId: string) {
    const data = await this.redisService.getGoogleState(stateId);
    if (!data) throw new Error('Invalid state');
    await this.redisService.deleteGoogleState(stateId);
    return data;
  }
}
```

### 2. JWT 블랙리스트 관리

#### 변경 전

```typescript
// ❌ 변경 전
export class AuthService {
  constructor(
    private redisService: RedisService,
    private configService: ConfigService
  ) {}

  async logout(refreshToken: string) {
    const blackListStore = this.configService.get('jwt.blackListStore');
    const refreshMaxAge = this.configService.get('jwt.refreshMaxAge');

    // ⚠️ 키 생성 로직이 서비스 계층에 노출
    await this.redisService.setExValue(
      `${blackListStore}${refreshToken}`,
      refreshMaxAge,
      1
    );
  }
}
```

#### 변경 후

```typescript
// ✅ 변경 후
export class AuthService {
  constructor(private redisService: RedisService) {}

  async logout(refreshToken: string, ttl: number) {
    // 키 생성 로직이 RedisService 내부로 캡슐화됨
    await this.redisService.addToBlacklist(refreshToken, ttl);
  }

  async checkBlacklist(refreshToken: string): Promise<boolean> {
    return await this.redisService.isBlacklisted(refreshToken);
  }
}
```

### 3. JWT Refresh Token Store

#### 변경 전

```typescript
// ❌ 변경 전
export class JwtTokenService {
  constructor(private configService: ConfigService) {}

  getStoreOptions() {
    const refreshTokenStore = this.configService.get('jwt.refreshStore');

    return {
      store: {
        name: refreshTokenStore, // ConfigService에서 직접 가져옴
      },
    };
  }
}
```

#### 변경 후

```typescript
// ✅ 변경 후
export class JwtTokenService {
  constructor(private redisService: RedisService) {}

  getStoreOptions() {
    return {
      store: {
        name: this.redisService.getRefreshStoreName(), // RedisService에서 조회
      },
    };
  }
}
```

### 4. OAuth 리다이렉트 세션

#### 변경 전

```typescript
// ❌ 변경 전
export class OAuthController {
  constructor(
    private redisService: RedisService,
    private configService: ConfigService
  ) {}

  async initiateLogin(returnUrl: string) {
    const sessionId = generateId();
    const store = this.configService.get('oauthRedirectSessionStore');

    await this.redisService.setExValue(
      `${store}${sessionId}`,
      300,
      returnUrl
    );
  }
}
```

#### 변경 후

```typescript
// ✅ 변경 후
export class OAuthController {
  constructor(private redisService: RedisService) {}

  async initiateLogin(returnUrl: string) {
    const sessionId = generateId();

    // 명확한 의도가 드러나는 전용 메서드
    await this.redisService.setRedirectSession(sessionId, returnUrl, 300);
  }
}
```

---

## RedisService 전용 메서드 목록

### OAuth 리다이렉트 세션

```typescript
await redisService.setRedirectSession(sessionId, redirectUri, ttl);
const session = await redisService.getRedirectSession(sessionId);
await redisService.deleteRedirectSession(sessionId);
```

### Naver OAuth State

```typescript
await redisService.setNaverState(stateId, data, ttl);
const data = await redisService.getNaverState(stateId);
await redisService.deleteNaverState(stateId);
```

### Google OAuth State

```typescript
await redisService.setGoogleState(stateId, data, ttl);
const data = await redisService.getGoogleState(stateId);
await redisService.deleteGoogleState(stateId);
```

### JWT Refresh Token Store

```typescript
const storeName = redisService.getRefreshStoreName();
```

### JWT 블랙리스트

```typescript
await redisService.addToBlacklist(tokenId, ttl);
const isBlacklisted = await redisService.isBlacklisted(tokenId);
```

### 비밀번호 재설정 토큰

```typescript
await redisService.setPasswordResetToken(token, userId, ttl);
const userId = await redisService.getPasswordResetToken(token);
await redisService.deletePasswordResetToken(token);
```

---

## 배포 체크리스트

### 1. 환경변수 설정 확인

```bash
# 각 환경별 .env 파일 확인
- [ ] .env.local (REDIS_KEY_PREFIX=)
- [ ] .env.development (REDIS_KEY_PREFIX=dev)
- [ ] .env.staging (REDIS_KEY_PREFIX=staging)
- [ ] .env.production (REDIS_KEY_PREFIX=prod 또는 빈 문자열)
```

### 2. 제거된 환경변수 삭제

```bash
# 모든 환경의 .env 파일에서 제거
- [ ] OAUTH_REDIRECT_SESSION_STORE_NAME
- [ ] JWT_REFRESH_STORE_NAME
- [ ] JWT_BLACKLIST_STORE_NAME
- [ ] JWT_NAVER_STATE_STORE_NAME
- [ ] JWT_GOOGLE_STATE_STORE_NAME
```

### 3. 코드 마이그레이션

```bash
# RedisService 범용 메서드 접근 → state 전용 메서드 사용
- [ ] OAuth 서비스들 (Naver, Google)
- [ ] Auth 서비스 (JWT 블랙리스트)
- [ ] JWT Token 서비스 (Refresh Store)
- [ ] 기타 Redis 키 사용하는 모든 서비스
```

### 4. 테스트

```bash
- [ ] 단위 테스트 실행 (npm run test)
- [ ] 통합 테스트 실행 (npm run test:e2e)
- [ ] 로컬 환경 테스트
- [ ] 개발 환경 배포 및 테스트
```

### 5. Redis 데이터 마이그레이션 (필요 시)

```bash
# 기존 키를 새 prefix 형식으로 마이그레이션
# 예: refreshToken → dev:refreshToken
```

---

## 롤백 가이드

문제 발생 시 이전 방식으로 롤백할 수 있습니다.

### 1. 환경변수 복구

```bash
# .env에 다시 추가
OAUTH_REDIRECT_SESSION_STORE_NAME=redirectSession:
JWT_REFRESH_STORE_NAME=refreshToken
JWT_BLACKLIST_STORE_NAME=blacklist:
JWT_NAVER_STATE_STORE_NAME=naverState:
JWT_GOOGLE_STATE_STORE_NAME=googleState:

# 제거
REDIS_KEY_PREFIX=
```

### 2. validation.schema.ts 복구

```typescript
const jwtConfigSchema = {
  // ... 기존 설정
  JWT_REFRESH_STORE_NAME: Joi.string().required(),
  JWT_BLACKLIST_STORE_NAME: Joi.string().required(),
  JWT_NAVER_STATE_STORE_NAME: Joi.string().required(),
  JWT_GOOGLE_STATE_STORE_NAME: Joi.string().required(),
};
```

### 3. RedisService 복구

- 범용 메서드들을 public으로 변경
- state 전용 메서드 제거
- ConfigService 의존성 다시 추가

---

## FAQ

### Q1: prefix를 빈 문자열로 두면 어떻게 되나요?

기존과 동일하게 작동합니다.

```bash
REDIS_KEY_PREFIX=
# → "refreshToken", "blacklist:123", "naverState:abc"
```

### Q2: 여러 환경이 같은 Redis를 사용하면 어떻게 하나요?

환경별로 다른 prefix를 설정하세요.

```bash
# dev 서버
REDIS_KEY_PREFIX=dev
# → "dev:refreshToken", "dev:blacklist:123"

# staging 서버
REDIS_KEY_PREFIX=staging
# → "staging:refreshToken", "staging:blacklist:123"
```

### Q3: 기존 Redis 데이터는 어떻게 되나요?

prefix를 빈 문자열로 두면 기존 데이터와 호환됩니다. prefix를 추가하려면 데이터 마이그레이션이 필요합니다.

### Q4: 테스트 환경에서는 어떻게 설정하나요?

테스트마다 고유한 prefix를 사용하세요.

```typescript
process.env.REDIS_KEY_PREFIX = `test:${Date.now()}`;
```

### Q5: 왜 RedisKeyBuilder를 사용하지 않나요?

RedisService가 모든 Redis 작업을 관리하므로, 별도의 Builder 클래스는 불필요한 추상화입니다. RedisService 내부에 `buildKey()` 헬퍼 메서드로 충분합니다.

---

## 문의

질문이나 문제가 있으면 개발팀에 문의하세요.
