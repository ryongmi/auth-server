# CLAUDE.md - Authentication Server

이 파일은 auth-server 작업 시 Claude Code의 가이드라인을 제공합니다.

## 서비스 개요

auth-server는 krgeobuk 생태계의 인증 서비스로, OAuth 및 JWT 기반의 사용자 인증을 담당합니다.

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

### 외부 의존성
프로젝트는 공유 기능을 위해 여러 `@krgeobuk/*` 패키지를 사용합니다:
- `@krgeobuk/core` - 핵심 유틸리티, 인터셉터, 필터
- `@krgeobuk/jwt` - JWT 토큰 서비스
- `@krgeobuk/oauth` - OAuth 제공자
- `@krgeobuk/swagger` - API 문서
- `@krgeobuk/database-config` - 데이터베이스 설정

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

## 개발 참고사항

### 환경 파일
환경 설정은 `./envs/` 디렉터리에 저장되고 docker-compose를 통해 로드됩니다.

### Import 경로 별칭
프로젝트는 깔끔한 import를 위해 `tsconfig.json`에 설정된 TypeScript 경로 별칭을 사용합니다 (예: `@modules`, `@config`, `@database`).

### ESLint 설정
import 순서 규칙과 Prettier 통합을 포함한 `@krgeobuk/eslint-config`를 사용합니다.

### 테스트 전략
- 단위 테스트: 소스 코드와 함께 `*.spec.ts` 파일
- E2E 테스트: 별도의 Jest 설정을 가진 `test/` 디렉터리
- 커버리지 리포트는 `../coverage`에 생성됩니다

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

## 개발 워크플로우

1. **표준 참조**: authz-server/CLAUDE.md의 공통 표준 확인
2. **Auth 특화**: 위 auth-server 특화 패턴 적용
3. **코드 품질**: `npm run lint-fix` 및 `npm run format` 실행
4. **타입 검사**: TypeScript 컴파일 확인
5. **테스트**: 단위/E2E 테스트 실행
6. **Docker 환경**: 로컬 환경에서 통합 테스트