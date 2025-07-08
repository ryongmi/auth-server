# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고할 수 있는 가이드를 제공합니다.

## 프로젝트 개요
krgeobuk 서비스 생태계를 위한 NestJS 기반 인증 서버(`auth-server`)입니다. 중앙 집중식 인증과 Google, Naver OAuth 통합을 제공합니다.

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
- **Auth 모듈** (`src/modules/auth/`) - JWT 인증, 토큰 관리
- **OAuth 모듈** (`src/modules/oauth/`) - Google과 Naver OAuth 통합
- **User 모듈** (`src/modules/user/`) - 사용자 관리 및 엔티티

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
- 글로벌 프리픽스: `/api`
- 설정된 출처에 대해 CORS 활성화
- 쿠키 기반 인증
- 개발 환경에서 Swagger 문서 제공

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