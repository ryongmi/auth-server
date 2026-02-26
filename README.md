# Auth Server

> KRGeobuk 생태계의 핵심 인증 서비스

krgeobuk 마이크로서비스 생태계의 중앙 인증 서버로, JWT 기반 인증, OAuth 소셜 로그인, SSO, 계정 관리, TCP 마이크로서비스 통신을 제공합니다.

---

## 주요 기능

### 인증 시스템
- **JWT 인증** - Access/Refresh Token (RSA 키 쌍 기반), HTTP-only 쿠키
- **SSO** - 다른 서비스 간 seamless 인증 연동 (`redirect_session`)
- **OAuth 소셜 로그인** - Google, Naver 통합

### 사용자 관리
- **회원가입/로그인/로그아웃** - 이메일 기반 인증
- **이메일 인증** - 가입 후 이메일 인증 처리
- **비밀번호 관리** - 찾기/재설정 이메일 발송
- **OAuth 계정 연동** - 기존 계정에 소셜 계정 연결/해제
- **계정 병합** - 이메일 중복 시 기존 계정과 OAuth 계정 통합

### 마이크로서비스
- **HTTP REST API** - 클라이언트 앱용 (포트 8000)
- **TCP 마이크로서비스** - 서비스 간 사용자 정보 조회 (포트 8010)

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | NestJS 10, TypeScript (ESM) |
| 데이터베이스 | MySQL 8 (TypeORM, snake_case) |
| 캐시/세션 | Redis (ioredis) |
| 인증 | JWT (RSA), OAuth 2.0 (Google/Naver) |
| 이메일 | Nodemailer + Handlebars 템플릿 |
| 암호화 | AES-256-CBC (OAuth 토큰 암호화) |
| 로깅 | Winston + 일별 로테이션 |

---

## 빠른 시작

### 환경 요구사항
- Node.js 18+
- Docker & Docker Compose
- 외부 인프라 네트워크 구성 (`krgeobuk-network`, `msa-network`, `shared-network`)

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp envs/.env.example envs/.env.local
# .env.local 파일에서 실제 값으로 수정

# 3. JWT 키 파일 생성
bash script/generate-jwt-keys.sh

# 4. 개발 서버 시작 (Docker)
npm run docker:local:up
```

서버가 다음 포트에서 실행됩니다:
- **HTTP API**: http://localhost:8000
- **Swagger**: http://localhost:8000/api-docs
- **TCP Service**: localhost:8010

### 스크립트

```bash
# 개발
npm run start:debug       # 개발 서버 (nodemon)
npm run build             # TypeScript 빌드
npm run build:watch       # 감시 모드 빌드

# 코드 품질
npm run lint              # ESLint 검사
npm run lint-fix          # ESLint 자동 수정
npm run format            # Prettier 포맷팅

# 테스트
npm run test              # 단위 테스트
npm run test:watch        # 감시 모드 테스트
npm run test:cov          # 커버리지 테스트
npm run test:e2e          # E2E 테스트

# Docker
npm run docker:local:up   # 로컬 스택 시작
npm run docker:local:down # 로컬 스택 중지
```

---

## 프로젝트 구조

```
src/
├── modules/                         # 기능 모듈
│   ├── auth/                        # JWT 인증, SSO, 토큰 관리
│   ├── user/                        # 사용자 관리 (HTTP + TCP)
│   ├── oauth/                       # Google/Naver OAuth
│   ├── email-verification/          # 이메일 인증
│   ├── password-reset/              # 비밀번호 재설정
│   ├── account-merge/               # 계정 병합 (오케스트레이터 + 상태 머신)
│   ├── image/                       # 이미지 프록시
│   └── health/                      # 헬스체크
│
├── common/                          # 공통 모듈
│   ├── jwt/                         # JWT 토큰 서비스, RefreshTokenGuard
│   ├── email/                       # 이메일 토큰 서비스
│   ├── crypto/                      # AES-256-CBC 암호화
│   ├── security/                    # 리다이렉트 URL 검증
│   ├── clients/                     # MSA TCP 클라이언트 설정
│   ├── constants/                   # Redis 키, 계정 병합 상수
│   └── utils/                       # 유틸리티 (UTC→KST 변환 등)
│
├── config/                          # 환경 설정 (Joi 검증)
│   ├── default.ts                   # 기본 설정
│   ├── database.ts / jwt.ts         # DB, JWT 설정
│   ├── google.ts / naver.ts         # OAuth 설정
│   └── validation.schema.ts         # 환경 변수 유효성 검증
│
├── database/                        # TypeORM + Redis
│   ├── database.module.ts
│   └── redis/
│
└── main.ts                          # HTTP(8000) + TCP(8010) 부트스트랩
```

---

## API 엔드포인트

> 전체 API 문서: http://localhost:8000/api-docs (Swagger)

### 인증 (`/auth/auth`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/auth/login` | SSO 로그인 리다이렉트 |
| POST | `/auth/login` | 로그인 (`?redirect_session=` 지원) |
| POST | `/auth/signup` | 회원가입 (`?redirect_session=` 지원) |
| POST | `/auth/logout` | 로그아웃 |
| POST | `/auth/refresh` | 토큰 갱신 (Throttle: 1초 2회) |
| POST | `/auth/initialize` | 클라이언트 초기화 (Throttle: 1초 3회) |
| POST | `/auth/verify-email/request` | 이메일 인증 요청 (Throttle: 1분 3회) |
| POST | `/auth/verify-email/confirm` | 이메일 인증 확인 |
| POST | `/auth/forgot-password` | 비밀번호 찾기 이메일 발송 (Throttle: 1분 3회) |
| POST | `/auth/reset-password` | 비밀번호 재설정 |

### OAuth (`/auth/oauth`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/oauth/login-google` | Google OAuth 시작 (`?redirect_session=`) |
| GET | `/oauth/login-google/callback` | Google OAuth 콜백 처리 |
| GET | `/oauth/login-naver` | Naver OAuth 시작 (`?redirect_session=`) |
| GET | `/oauth/login-naver/callback` | Naver OAuth 콜백 처리 |
| GET | `/oauth/link-google` | Google 계정 연동 시작 (인증 필요) |
| GET | `/oauth/link-naver` | Naver 계정 연동 시작 (인증 필요) |

### 사용자 (`/auth/users`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/users` | 유저 목록 조회 | ADMIN/SUPER_ADMIN |
| GET | `/users/me` | 내 프로필 조회 | Optional |
| PATCH | `/users/me` | 프로필 수정 | 인증 필요 |
| PATCH | `/users/password` | 비밀번호 변경 | 인증 필요 |
| DELETE | `/users/me` | 계정 삭제 | 인증 필요 |
| GET | `/users/:userId` | 특정 유저 조회 | ADMIN/SUPER_ADMIN |

### 계정 병합 (`/auth/account-merge`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/account-merge/verify-token` | 병합 토큰 검증 (`?token=`) | - |
| POST | `/account-merge/request` | 병합 요청 시작 | 인증 필요 |
| GET | `/account-merge/:requestId` | 병합 요청 조회 | 인증 필요 |
| POST | `/account-merge/:requestId/confirm` | 병합 승인 | 인증 필요 |
| POST | `/account-merge/:requestId/reject` | 병합 거부 | 인증 필요 |

### 기타

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 헬스체크 |
| GET | `/health/ready` | 준비 상태 확인 |

---

## TCP 마이크로서비스 (포트 8010)

다른 서비스(authz-server 등)에서 `auth-server:8010`으로 사용자 정보를 조회합니다.

### User TCP 패턴

| 메시지 패턴 | 요청 | 응답 |
|------------|------|------|
| `user.findById` | `{ userId: string }` | `UserEntity \| null` |
| `user.getDetailById` | `{ userId: string }` | `UserDetail \| null` |
| `user.findByEmail` | `{ email: string }` | `UserEntity \| null` |
| `user.findByIds` | `{ userIds: string[] }` | `UserEntity[]` |
| `user.findByFilter` | `{ filter: UserFilter }` | `UserEntity[]` |
| `user.exists` | `{ userId: string }` | `boolean` |
| `user.isEmailVerified` | `{ userId: string }` | `boolean` |
| `user.getStats` | `{}` | `{ totalUsers, verifiedUsers }` |

### 다른 서비스에서 연결 설정

```typescript
// app.module.ts
ClientsModule.register([
  {
    name: 'AUTH_SERVICE',
    transport: Transport.TCP,
    options: {
      host: 'auth-server',  // Docker 네트워크 내 호스트명
      port: 8110,           // authz-server의 TCP 포트 예시
    },
  },
])

// 사용
const user = await this.authClient
  .send('user.findById', { userId })
  .toPromise();
```

---

## 환경 변수

```bash
# ===== 서버 =====
NODE_ENV=development
PORT=8000
TCP_PORT=8010
APP_NAME=auth-server
AUTH_SERVER_URL=http://localhost:8000/auth
AUTH_CLIENT_URL=http://localhost:3000
PORTAL_CLIENT_URL=http://localhost:3200
CORS_ORIGINS=http://localhost:3000,http://localhost:3200

# ===== 외부 서비스 =====
AUTHZ_SERVICE_HOST=authz-server
AUTHZ_SERVICE_PORT=8110

# ===== MySQL (중앙 인프라) =====
MYSQL_HOST=krgeobuk-mysql
MYSQL_PORT=3306
MYSQL_USER=dev_user
MYSQL_PASSWORD=your-mysql-password
MYSQL_DATABASE=auth_dev

# ===== Redis (중앙 인프라) =====
REDIS_HOST=krgeobuk-redis
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_KEY_PREFIX=dev               # 개발: dev, 프로덕션: prod

# ===== JWT (RSA 키 쌍) =====
JWT_ACCESS_PRIVATE_KEY_PATH=./keys/access-private.key
JWT_ACCESS_PUBLIC_KEY_PATH=./keys/access-public.key
JWT_REFRESH_PRIVATE_KEY_PATH=./keys/refresh-private.key
JWT_REFRESH_PUBLIC_KEY_PATH=./keys/refresh-public.key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_COOKIE_DOMAIN=.localhost

# ===== Google OAuth =====
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=http://localhost:8000/auth/oauth/login-google/callback

# ===== Naver OAuth =====
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
NAVER_REDIRECT_URL=http://localhost:8000/auth/oauth/login-naver/callback

# ===== 암호화 (OAuth 토큰 저장) =====
ENCRYPTION_KEY=your-encryption-key-minimum-32-chars
ENCRYPTION_SALT=your-unique-salt-value

# ===== 이메일 =====
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM="krgeobuk <noreply@krgeobuk.com>"
```

전체 환경 변수 목록: `envs/.env.example`

---

## Docker

```yaml
# docker-compose.yaml 핵심 구성
services:
  server:
    ports:
      - 8000:8000    # HTTP API
      - 9229:9229    # Node.js 디버거
    networks:
      - krgeobuk-network   # 중앙 MySQL, Redis
      - msa-network        # 마이크로서비스 간 통신
      - shared-network     # 공유 리소스
```

Dockerfile은 멀티 스테이지로 구성됩니다: `deps → build → local/development/production`

---

## 포트 구성

| 서비스 | 포트 | 프로토콜 |
|--------|------|---------|
| auth-server HTTP | 8000 | REST API |
| auth-server TCP | 8010 | 마이크로서비스 |
| MySQL | 3306 | 중앙 인프라 |
| Redis | 6379 | 중앙 인프라 |

---

## 문서

| 파일 | 설명 |
|------|------|
| [CLAUDE.md](./CLAUDE.md) | 개발 가이드 (패턴, 표준, 워크플로우) |
| [docs/](./docs/) | 기능별 설계 문서 |
