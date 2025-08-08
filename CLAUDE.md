# CLAUDE.md - Authentication Server

이 파일은 auth-server 작업 시 Claude Code의 가이드라인을 제공합니다.

## 서비스 개요

auth-server는 krgeobuk 생태계의 핵심 인증 서비스로, OAuth 및 JWT 기반의 사용자 인증을 담당합니다. 

### MVP 완료 상태
- **HTTP API 서버** (포트 8000) - REST API 제공
- **TCP 마이크로서비스** (포트 8010) - 서비스 간 통신
- **OAuth 통합** - Google, Naver 소셜 로그인
- **JWT 토큰 관리** - Access/Refresh Token 체계
- **완전한 사용자 관리** - 가입, 인증, 권한 처리
- **프로덕션 준비** - Docker, 로깅, 모니터링 완비

## 핵심 명령어

### 개발
- `npm run start:debug` - nodemon으로 개발 서버 시작
- `npm run build` - TypeScript와 별칭 해결로 프로젝트 빌드
- `npm run build:watch` - 감시 모드로 빌드

### 코드 품질
- `npm run lint` - 소스 파일에 ESLint 실행
- `npm run lint-fix` - 자동 수정과 함께 ESLint 실행
- `npm run format` - Prettier로 코드 포맷팅

### 테스트
- `npm run test` - 단위 테스트 실행
- `npm run test:watch` - 감시 모드로 테스트 실행
- `npm run test:cov` - 커버리지와 함께 테스트 실행
- `npm run test:e2e` - 엔드투엔드 테스트 실행

### Docker 운영
- `npm run docker:local:up` - 로컬 Docker 스택 시작
- `npm run docker:dev:up` - 개발 Docker 스택 시작
- `npm run docker:prod:up` - 프로덕션 Docker 스택 시작
- `npm run docker:local:down` - 로컬 Docker 스택 중지

## 아키텍처

### 핵심 구조
- **진입점**: `src/main.ts` - Swagger 설정과 함께 애플리케이션 부트스트랩
- **앱 모듈**: `src/app.module.ts` - 모든 기능 모듈을 가져오는 루트 모듈
- **글로벌 설정**: `src/setNestApp.ts` - 글로벌 파이프, 필터, 인터셉터, CORS 설정

### 기능 모듈
- **Auth 모듈** (`src/modules/auth/`) - JWT 인증, 토큰 관리 (HTTP only)
- **OAuth 모듈** (`src/modules/oauth/`) - Google과 Naver OAuth 통합
- **User 모듈** (`src/modules/user/`) - 사용자 관리 및 엔티티
  - `user.controller.ts` - HTTP REST API 엔드포인트
  - `user-tcp.controller.ts` - TCP 마이크로서비스 메시지 패턴

### 설정
- **Config 디렉터리** (`src/config/`) - 환경별 설정
- **Database 모듈** (`src/database/`) - TypeORM 및 Redis 설정
- **JWT 모듈** (`src/common/jwt/`) - JWT 토큰 처리 및 가드

### 공유 라이브러리 의존성
krgeobuk 생태계 표준화를 위한 `@krgeobuk/*` 패키지들:
- `@krgeobuk/core` - 핵심 유틸리티, 인터셉터, 필터
- `@krgeobuk/jwt` - JWT 토큰 서비스 및 가드
- `@krgeobuk/oauth` - OAuth 제공자 (Google, Naver)
- `@krgeobuk/swagger` - API 문서화 설정
- `@krgeobuk/database-config` - TypeORM 및 Redis 설정
- `@krgeobuk/auth` - 인증 관련 DTO, 인터페이스
- `@krgeobuk/user` - 사용자 관리 기능
- `@krgeobuk/shared` - 공유 타입 및 유틸리티
- `@krgeobuk/service` - 서비스 등록 관리

### 데이터베이스 설정
- **MySQL**: 기본 데이터베이스 (Docker에서 포트 3307)
- **Redis**: 세션 저장 및 캐싱 (Docker에서 포트 6380)
- **TypeORM**: snake_case 네이밍 전략을 사용하는 ORM

### Docker 환경
애플리케이션은 멀티 컨테이너 설정으로 실행됩니다:
- Asia/Seoul 시간대를 사용하는 MySQL 데이터베이스
- 세션 관리를 위한 Redis
- 개발 시 핫 리로드를 지원하는 애플리케이션 서버
- 서비스 통신을 위한 외부 MSA 네트워크

### API 구조
- **HTTP REST API**: 글로벌 프리픽스 `/api`
- **TCP 마이크로서비스**: 포트 8010에서 실행
- 설정된 출처에 대해 CORS 활성화
- 쿠키 기반 인증
- 개발 환경에서 Swagger 문서 제공

## TCP 마이크로서비스 통신

### 서버 설정
auth-server는 HTTP API 서버(포트 8000)와 TCP 마이크로서비스(포트 8010)를 동시에 실행합니다.

```typescript
// main.ts
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.TCP,
  options: {
    host: '0.0.0.0',
    port: 8010,
  },
});
```

### User TCP 엔드포인트

다른 서비스에서 auth-server:8010으로 TCP 통신하여 사용자 정보를 조회할 수 있습니다.

#### 사용 가능한 메시지 패턴

| 패턴 | 설명 | 요청 데이터 | 응답 타입 |
|------|------|-------------|-----------|
| `user.findById` | 사용자 ID로 조회 | `{ userId: string }` | `UserEntity \| null` |
| `user.getDetailById` | 상세 정보 조회 | `{ userId: string }` | `UserDetail \| null` |
| `user.findByEmail` | 이메일로 조회 | `{ email: string }` | `UserEntity \| null` |
| `user.findByIds` | 여러 사용자 조회 | `{ userIds: string[] }` | `UserEntity[]` |
| `user.findByFilter` | 필터로 조회 | `{ filter: UserFilter }` | `UserEntity[]` |
| `user.exists` | 존재 여부 확인 | `{ userId: string }` | `boolean` |
| `user.getStats` | 사용자 통계 | `{}` | `{ totalUsers: number, verifiedUsers: number }` |
| `user.isEmailVerified` | 이메일 인증 확인 | `{ userId: string }` | `boolean` |

#### 다른 서비스에서 사용 예시

```typescript
// authz-server에서 auth-server TCP 호출
@Injectable()
export class RoleService {
  constructor(
    @Inject('AUTH_SERVICE') private authClient: ClientProxy
  ) {}

  async getRoleWithUsers(roleId: string) {
    // 역할에 속한 사용자 ID들 조회
    const userIds = await this.getUserIdsByRole(roleId);
    
    // auth-server TCP로 사용자 정보 조회
    const users = await this.authClient.send('user.findByIds', { userIds }).toPromise();
    
    return {
      role: await this.findById(roleId),
      users
    };
  }

  async getUserDetail(userId: string): Promise<UserDetail | null> {
    return this.authClient.send('user.getDetailById', { userId }).toPromise();
  }

  async checkUserExists(userId: string): Promise<boolean> {
    return this.authClient.send('user.exists', { userId }).toPromise();
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return this.authClient.send('auth.refreshToken', { refreshToken }).toPromise();
  }
}
```

#### 클라이언트 설정 예시

```typescript
// authz-server app.module.ts
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          host: 'auth-server', // Docker 네트워크에서
          port: 8010,
        },
      },
    ]),
  ],
})
export class AppModule {}
```

## 개발 가이드라인

### 환경 설정
```bash
# 서버 설정
NODE_ENV=development
PORT=8000
TCP_PORT=8010
APP_NAME=auth-server

# 클라이언트 URL
AUTH_CLIENT_URL=http://localhost:3000
PORTAL_CLIENT_URL=http://localhost:3200

# MySQL 데이터베이스 (Docker 컨테이너)
MYSQL_HOST=auth-mysql
MYSQL_PORT=3306              # 내부 통신 포트
MYSQL_OPEN_PORT=3307         # 외부 접근 포트
MYSQL_USER=krgeobuk
MYSQL_PASSWORD=your-mysql-password
MYSQL_DATABASE=auth

# Redis 세션 저장소 (Docker 컨테이너)
REDIS_HOST=auth-redis
REDIS_PORT=6379              # 내부 통신 포트
REDIS_OPEN_PORT=6380         # 외부 접근 포트
REDIS_PASSWORD=your-redis-password

# JWT 공개키/개인키 방식 (RSA)
JWT_ACCESS_PRIVATE_KEY_PATH=./keys/access-private.key
JWT_ACCESS_PUBLIC_KEY_PATH=./keys/access-public.key
JWT_REFRESH_PRIVATE_KEY_PATH=./keys/refresh-private.key
JWT_REFRESH_PUBLIC_KEY_PATH=./keys/refresh-public.key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=http://localhost:8000/api/oauth/login-google/callback

# Naver OAuth 2.0
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret  
NAVER_REDIRECT_URL=http://localhost:8000/api/oauth/login-naver/callback
```

### Import 경로 별칭
```typescript
// tsconfig.json에 설정된 경로 별칭
import { UserService } from '@modules/user/user.service';
import { DatabaseConfig } from '@config/database';
import { RedisService } from '@database/redis/redis.service';
import { JwtTokenService } from '@common/jwt/jwt-token.service';
```

### 코드 품질 관리
```bash
# 린팅 및 포맷팅 (필수 실행)
npm run lint-fix    # ESLint 자동 수정
npm run format      # Prettier 포맷팅

# 빌드 및 타입 검사
npm run build       # TypeScript 컴파일
npm run build:watch # 감시 모드 빌드
```

### 테스트 전략
```bash
# 단위 테스트
npm run test        # Jest 테스트 실행
npm run test:watch  # 감시 모드
npm run test:cov    # 커버리지 포함

# 통합 테스트
npm run test:e2e    # 엔드투엔드 테스트
```

### 로깅 시스템
- **Winston** 기반 구조화된 로깅
- **개발환경**: 콘솔 출력
- **프로덕션**: 파일 로깅 + 일별 로테이션
- **로그 레벨**: error, warn, info, debug

---

# 🔥 NestJS 공통 개발 표준

> **중요**: auth-server의 NestJS 개발 시 [authz-server/CLAUDE.md](../authz-server/CLAUDE.md)의 **"krgeobuk NestJS 서버 공통 개발 표준"** 섹션을 필수로 참조하세요.

## 공통 표준 적용 영역

- **API 응답 포맷**: SerializerInterceptor, HttpExceptionFilter 표준
- **컨트롤러 개발 가이드**: 표준화된 엔드포인트 패턴, Swagger 문서화
- **서비스 계층 설계**: 메서드 구조, 에러 처리, 로깅 표준
- **TypeScript 코딩 표준**: 타입 안전성, 네이밍 규칙
- **Repository 최적화**: 쿼리 최적화, 성능 개선
- **TCP 컨트롤러 표준**: 메시지 패턴, 로깅 최적화

## Auth Server 특화 내용

### OAuth Provider 패턴

auth-server는 OAuth 인증 제공자로서 다음과 같은 특화된 패턴을 사용합니다:

```typescript
// OAuth Controller 패턴
@Controller('oauth')
export class OAuthController {
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth(): Promise<void> {
    // Google OAuth 리다이렉트
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthCallback(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    // OAuth 콜백 처리 및 JWT 토큰 발급
  }
}
```

### JWT 토큰 관리 패턴

```typescript
// JWT Service 패턴
@Injectable()
export class AuthService {
  async login(user: User): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, { expiresIn: '7d' })
    ]);

    return { accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    // 리프레시 토큰 검증 및 새 토큰 발급
  }
}
```

### User TCP 엔드포인트 패턴

다른 서비스에서 사용자 정보를 조회할 때의 표준 패턴:

```typescript
// TCP Controller for User Service
@Controller()
export class UserTcpController {
  @MessagePattern('user.findById')
  async findById(@Payload() data: { userId: string }): Promise<UserEntity | null> {
    return this.userService.findById(data.userId);
  }

  @MessagePattern('user.findByEmail')  
  async findByEmail(@Payload() data: { email: string }): Promise<UserEntity | null> {
    return this.userService.findByEmail(data.email);
  }

  @MessagePattern('user.exists')
  async exists(@Payload() data: { userId: string }): Promise<boolean> {
    return this.userService.exists(data.userId);
  }
}
```

### 세션 및 쿠키 관리

```typescript
// Cookie-based Authentication
@Injectable()
export class AuthService {
  setAuthCookies(res: Response, tokens: TokenPair): void {
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000, // 15분
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });
  }
}
```

## API 엔드포인트

### HTTP REST API (포트 8000)

#### 인증 관련 (`/api/auth`)
```bash
POST /api/auth/login          # 로그인
POST /api/auth/signup         # 회원가입  
POST /api/auth/logout         # 로그아웃
POST /api/auth/refresh        # 토큰 갱신
POST /api/auth/forgot-password # 비밀번호 찾기
POST /api/auth/reset-password  # 비밀번호 재설정
```

#### OAuth 관련 (`/api/oauth`)
```bash
GET  /api/oauth/login-google   # Google OAuth 시작
GET  /api/oauth/callback/google # Google OAuth 콜백
GET  /api/oauth/login-naver    # Naver OAuth 시작
GET  /api/oauth/callback/naver  # Naver OAuth 콜백
```

#### 사용자 관리 (`/api/user`)
```bash
GET    /api/user/profile      # 사용자 프로필 조회
PUT    /api/user/profile      # 사용자 프로필 수정
DELETE /api/user/account      # 계정 삭제
POST   /api/user/verify-email # 이메일 인증
```

### TCP 마이크로서비스 (포트 8010)

#### 사용자 조회 패턴
```typescript
// 다른 서비스에서 TCP 호출 예시
const user = await client.send('user.findById', { userId }).toPromise();
const users = await client.send('user.findByIds', { userIds }).toPromise();
const exists = await client.send('user.exists', { userId }).toPromise();
```

## 개발 워크플로우

### 1. 개발 환경 설정
```bash
# 1. 환경 파일 복사 및 설정
cp envs/.env.example envs/.env.local
# .env.local에서 실제 값으로 수정

# 2. JWT 키 파일 생성
bash script/generate-jwt-keys.sh

# 3. Docker 인프라 시작
npm run docker:local:up

# 4. 개발 서버 시작 (핫 리로드)
npm run start:debug

# 5. 코드 품질 확인
npm run lint-fix && npm run format

# 6. 테스트 실행
npm run test
```

### 2. 기능 개발 순서
1. **타입 정의**: `@krgeobuk/*` 공유 타입 활용
2. **엔티티 설계**: TypeORM 엔티티 생성
3. **Repository 구현**: 데이터 접근 계층
4. **서비스 로직**: 비즈니스 로직 구현
5. **컨트롤러 개발**: HTTP/TCP 엔드포인트
6. **Swagger 문서화**: API 문서 자동 생성
7. **테스트 작성**: 단위/통합 테스트

### 3. 배포 준비
- **린팅**: `npm run lint` 통과 필수
- **빌드**: `npm run build` 성공 확인
- **테스트**: `npm run test:e2e` 통과
- **Docker**: `npm run docker:prod:up` 배포 테스트