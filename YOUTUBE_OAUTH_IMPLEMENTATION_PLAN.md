# YouTube OAuth 토큰 관리 구현 계획

## 📌 개요

auth-server를 **인증 + OAuth 토큰 저장소**로 확장하여, my-pick-server가 사용자별 YouTube API를 호출할 수 있도록 구현합니다.

### 핵심 원칙
- ✅ **auth-server**: 인증 + OAuth 토큰 저장소 역할 (YouTube API 프록시는 하지 않음)
- ✅ **my-pick-server**: YouTube 비즈니스 로직 소유, auth-server에서 토큰만 조회
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
  ├─ auth-server:8010 (TCP) ← my-pick-server가 토큰 조회
  ├─ my-pick-server:4000 (HTTP API)
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
4. my-pick-server: 사용자가 댓글 작성 요청
   ↓
5. my-pick-server → auth-server (TCP): "userId의 YouTube 토큰 줘"
   ↓
6. auth-server: 토큰 복호화 후 반환 (만료 시 자동 갱신)
   ↓
7. my-pick-server: YouTube API 직접 호출 (댓글 작성)
   ↓
8. YouTube API: 실제 댓글 작성
```

---

## 📦 Phase 1: auth-server - OAuth 토큰 저장 기능 구현

### 1.1 데이터베이스 마이그레이션

**파일**: `src/database/migrations/add-oauth-youtube-tokens.sql` (신규)

```sql
-- OAuth 계정 테이블에 YouTube 토큰 필드 추가
ALTER TABLE oauth_account
ADD COLUMN access_token TEXT NULL COMMENT '암호화된 YouTube 액세스 토큰',
ADD COLUMN refresh_token TEXT NULL COMMENT '암호화된 YouTube 리프레시 토큰',
ADD COLUMN token_expires_at TIMESTAMP NULL COMMENT '토큰 만료 시각',
ADD COLUMN scopes VARCHAR(500) NULL COMMENT 'OAuth 스코프 (email profile youtube.force-ssl)',
ADD INDEX idx_oauth_token_expires (token_expires_at);
```

### 1.2 암호화 서비스 구현

**파일**: `src/common/encryption/encryption.service.ts` (신규)

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly secretKey: Buffer;

  constructor(private configService: ConfigService) {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key || key.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters');
    }
    this.secretKey = crypto.scryptSync(key, 'salt', 32);
  }

  /**
   * 문자열 암호화 (AES-256-CBC)
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * 암호화된 문자열 복호화
   */
  decrypt(hash: string): string {
    const [ivHex, encryptedHex] = hash.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
```

**파일**: `src/common/encryption/encryption.module.ts` (신규)

```typescript
import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
```

### 1.3 OAuth 엔티티 확장

**파일**: `src/modules/oauth/entities/oauth-account.entity.ts` (수정)

```typescript
import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntityUUID } from '@krgeobuk/core/entities';
import {
  OAuthAccountProviderType,
  OAUTH_ACCOUNT_PROVIDER_TYPE_VALUES,
} from '@krgeobuk/shared/oauth';

@Entity('oauth_account')
@Index(['id', 'userId'], { unique: true })
@Index('IDX_OAUTH_ACCOUNT_USER_ID', ['userId'])
@Unique(['userId', 'provider'])
export class OAuthAccountEntity extends BaseEntityUUID {
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerId!: string;

  @Column({ type: 'enum', enum: OAUTH_ACCOUNT_PROVIDER_TYPE_VALUES })
  provider!: OAuthAccountProviderType;

  @Column({ type: 'uuid' })
  userId!: string;

  // ==================== YouTube OAuth 토큰 필드 ====================

  @Column({ type: 'text', nullable: true })
  accessToken?: string; // 암호화된 액세스 토큰

  @Column({ type: 'text', nullable: true })
  refreshToken?: string; // 암호화된 리프레시 토큰

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt?: Date; // 토큰 만료 시각

  @Column({ type: 'varchar', length: 500, nullable: true })
  scopes?: string; // OAuth 스코프 (예: "email profile youtube.force-ssl")
}
```

### 1.4 Google OAuth 스코프 확장

**파일**: `src/modules/oauth/oauth.controller.ts` (수정)

```typescript
@Get('login-google')
@HttpCode(OAuthResponse.OAUTH_LOGIN_START_REDIRECT.statusCode)
@SwaggerApiOperation({ summary: 'Google OAuth SSO 시작' })
async loginGoogle(
  @Res() res: Response,
  @Query('redirect_session') redirectSession: string
): Promise<void> {
  const state = await this.oauthService.generateState(
    OAuthAccountProviderType.GOOGLE,
    redirectSession
  );
  const clientId = this.configService.get<GoogleConfig['clientId']>('google.clientId');
  const redirectUrl = this.configService.get<GoogleConfig['redirectUrl']>('google.redirectUrl');

  const url =
    'https://accounts.google.com/o/oauth2/v2/auth' +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUrl}` +
    '&response_type=code' +
    // ✨ YouTube API 스코프 추가
    '&scope=email profile https://www.googleapis.com/auth/youtube.force-ssl' +
    `&state=${state}` +
    '&access_type=offline' +     // ✨ refresh_token 획득을 위해 필수
    '&prompt=consent';            // ✨ 매번 동의 화면 표시 (refresh_token 보장)

  return res.redirect(url);
}
```

### 1.5 OAuth 서비스 토큰 저장 로직

**파일**: `src/modules/oauth/oauth.service.ts` (수정)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, FindOptionsWhere, In, UpdateResult } from 'typeorm';
import { Response } from 'express';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import { OAuthException } from '@krgeobuk/oauth/exception';

import { EncryptionService } from '@common/encryption/encryption.service.js';
import { JwtTokenService } from '@common/jwt/index.js';
import { UserEntity, UserService } from '@modules/user/index.js';
import { RedisService } from '@database/index.js';

import { OAuthAccountEntity } from './entities/oauth-account.entity.js';
import { GoogleOAuthService } from './google.service.js';
import { NaverOAuthService } from './naver.service.js';
import { OAuthRepository } from './oauth.repository.js';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly jwtService: JwtTokenService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly naverOAuthService: NaverOAuthService,
    private readonly oauthRepo: OAuthRepository,
    private readonly encryptionService: EncryptionService  // ✨ 추가
  ) {}

  // ... 기존 메서드들 ...

  async loginGoogle(
    res: Response,
    transactionManager: EntityManager,
    query: NaverOAuthCallbackQuery
  ): Promise<string> {
    this.logger.log(`${this.loginGoogle.name} - 시작 되었습니다.`);

    const { tokenData, googleUserInfo } = await this.googleOAuthService.getGoogleUserInfo(query);
    const providerType = OAuthAccountProviderType.GOOGLE;

    const user = await this.oauthLogin(googleUserInfo, providerType, transactionManager);

    // ==================== ✨ YouTube 토큰 저장 ====================

    // OAuth 계정 조회
    const [oauth] = await this.findByAnd({ userId: user.id, provider: providerType });

    if (!oauth) {
      this.logger.error(`[OAUTH_ACCOUNT_NOT_FOUND] OAuth 계정을 찾을 수 없습니다`, {
        userId: user.id,
        provider: providerType,
      });
      throw OAuthException.userSaveFailed(providerType);
    }

    // YouTube 토큰 암호화 저장
    if (tokenData.accessToken) {
      this.logger.log(`YouTube 토큰 저장 중 - userId: ${user.id}`);

      oauth.accessToken = this.encryptionService.encrypt(tokenData.accessToken);
      oauth.refreshToken = tokenData.refreshToken
        ? this.encryptionService.encrypt(tokenData.refreshToken)
        : null;
      oauth.tokenExpiresAt = new Date(Date.now() + tokenData.expiresIn * 1000);
      oauth.scopes = tokenData.scope;

      await this.updateOAuthAccount(oauth, transactionManager);

      this.logger.log(`YouTube 토큰 저장 완료 - userId: ${user.id}, expiresAt: ${oauth.tokenExpiresAt}`);
    } else {
      this.logger.warn(`YouTube 토큰 누락 - userId: ${user.id}`);
    }

    // ==================== JWT 발급 (기존 로직) ====================

    const payload = {
      sub: user.id,
      // tokenData는 JWT에 포함하지 않음 (DB에만 저장)
    };

    const { accessToken, refreshToken } =
      await this.jwtService.signAccessTokenAndRefreshToken(payload);

    this.jwtService.setRefreshTokenToCookie(res, refreshToken);

    // SSO 리다이렉트 처리
    const redirectUrl = await this.handleSSORedirect(
      query.state,
      providerType,
      accessToken,
      refreshToken
    );

    this.logger.log(`${this.loginGoogle.name} - 성공적으로 종료되었습니다.`);

    return redirectUrl;
  }

  // ... 기존 메서드들 ...
}
```

### 1.6 OAuth 모듈 의존성 추가

**파일**: `src/modules/oauth/oauth.module.ts` (수정)

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EncryptionModule } from '@common/encryption/encryption.module.js';
import { UserModule } from '@modules/user/user.module.js';
import { RedisModule } from '@database/redis/redis.module.js';
import { JwtModule } from '@common/jwt/jwt.module.js';

import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';
import { OAuthRepository } from './oauth.repository.js';
import { GoogleOAuthService } from './google.service.js';
import { NaverOAuthService } from './naver.service.js';
import { OAuthAccountEntity } from './entities/oauth-account.entity.js';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([OAuthAccountEntity]),
    EncryptionModule,  // ✨ 추가
    UserModule,
    RedisModule,
    JwtModule,
  ],
  providers: [
    OAuthService,
    OAuthRepository,
    GoogleOAuthService,
    NaverOAuthService,
  ],
  controllers: [OAuthController],
  exports: [OAuthService, OAuthRepository],
})
export class OAuthModule {}
```

---

## 📦 Phase 2: auth-server - TCP 토큰 조회 API 구현

### 2.1 OAuth Token TCP Service

**파일**: `src/modules/oauth/oauth-token-tcp.service.ts` (신규)

```typescript
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import { lastValueFrom, map } from 'rxjs';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';

import { EncryptionService } from '@common/encryption/encryption.service.js';
import { GoogleConfig } from '@common/interfaces/index.js';

import { OAuthAccountEntity } from './entities/oauth-account.entity.js';
import { OAuthRepository } from './oauth.repository.js';

@Injectable()
export class OAuthTokenTcpService {
  private readonly logger = new Logger(OAuthTokenTcpService.name);

  constructor(
    private oauthRepo: OAuthRepository,
    private encryptionService: EncryptionService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  /**
   * YouTube 액세스 토큰 조회 (자동 갱신 포함)
   */
  async getYouTubeAccessToken(userId: string): Promise<{
    accessToken: string;
    expiresAt: Date;
  }> {
    this.logger.debug(`YouTube 토큰 조회 시작 - userId: ${userId}`);

    const oauth = await this.oauthRepo.findOne({
      where: { userId, provider: OAuthAccountProviderType.GOOGLE }
    });

    if (!oauth?.accessToken) {
      this.logger.warn(`YouTube 토큰 없음 - userId: ${userId}`);
      throw new UnauthorizedException({
        code: 'OAUTH_TOKEN_NOT_FOUND',
        message: 'YouTube 권한이 없습니다. Google 로그인을 다시 시도해주세요.'
      });
    }

    // 토큰 만료 확인 (5분 버퍼)
    const expiryBuffer = new Date(Date.now() + 5 * 60 * 1000);
    if (oauth.tokenExpiresAt && oauth.tokenExpiresAt < expiryBuffer) {
      this.logger.log(`토큰 만료 임박, 갱신 시작 - userId: ${userId}, expiresAt: ${oauth.tokenExpiresAt}`);
      await this.refreshGoogleToken(oauth);
    }

    const accessToken = this.encryptionService.decrypt(oauth.accessToken);

    this.logger.debug(`YouTube 토큰 조회 완료 - userId: ${userId}`);

    return {
      accessToken,
      expiresAt: oauth.tokenExpiresAt!
    };
  }

  /**
   * Google OAuth 토큰 갱신
   */
  private async refreshGoogleToken(oauth: OAuthAccountEntity): Promise<void> {
    if (!oauth.refreshToken) {
      this.logger.error(`Refresh Token 없음 - userId: ${oauth.userId}`);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_NOT_FOUND',
        message: 'Refresh Token이 없습니다. 다시 로그인해주세요.'
      });
    }

    const refreshToken = this.encryptionService.decrypt(oauth.refreshToken);
    const clientId = this.configService.get<GoogleConfig['clientId']>('google.clientId');
    const clientSecret = this.configService.get<GoogleConfig['clientSecret']>('google.clientSecret');

    try {
      const response = await lastValueFrom(
        this.httpService.post('https://oauth2.googleapis.com/token', {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        }).pipe(map(res => res.data))
      );

      this.logger.log(`Google 토큰 갱신 성공 - userId: ${oauth.userId}`);

      // 새 토큰 저장
      oauth.accessToken = this.encryptionService.encrypt(response.access_token);
      oauth.tokenExpiresAt = new Date(Date.now() + response.expires_in * 1000);

      // refresh_token이 갱신되었다면 업데이트 (선택적)
      if (response.refresh_token) {
        oauth.refreshToken = this.encryptionService.encrypt(response.refresh_token);
      }

      await this.oauthRepo.save(oauth);

      this.logger.log(`토큰 갱신 DB 저장 완료 - userId: ${oauth.userId}, expiresAt: ${oauth.tokenExpiresAt}`);
    } catch (error) {
      this.logger.error('Google 토큰 갱신 실패', {
        userId: oauth.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new UnauthorizedException({
        code: 'TOKEN_REFRESH_FAILED',
        message: '토큰 갱신에 실패했습니다. 다시 로그인해주세요.'
      });
    }
  }

  /**
   * 사용자의 YouTube 권한 여부 확인
   */
  async hasYouTubeAccess(userId: string): Promise<boolean> {
    const oauth = await this.oauthRepo.findOne({
      where: { userId, provider: OAuthAccountProviderType.GOOGLE }
    });

    const hasAccess = !!(oauth?.accessToken && oauth?.scopes?.includes('youtube'));

    this.logger.debug(`YouTube 권한 확인 - userId: ${userId}, hasAccess: ${hasAccess}`);

    return hasAccess;
  }
}
```

### 2.2 OAuth Token TCP Controller

**파일**: `src/modules/oauth/oauth-token-tcp.controller.ts` (신규)

```typescript
import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { OAuthTokenTcpService } from './oauth-token-tcp.service.js';

@Controller()
export class OAuthTokenTcpController {
  private readonly logger = new Logger(OAuthTokenTcpController.name);

  constructor(private oauthTokenService: OAuthTokenTcpService) {}

  /**
   * YouTube 액세스 토큰 조회 (TCP)
   */
  @MessagePattern('oauth.youtube.getAccessToken')
  async getYouTubeAccessToken(@Payload() data: { userId: string }) {
    this.logger.debug(`[TCP] oauth.youtube.getAccessToken - userId: ${data.userId}`);

    try {
      const result = await this.oauthTokenService.getYouTubeAccessToken(data.userId);

      this.logger.log(`[TCP] YouTube 토큰 조회 성공 - userId: ${data.userId}`);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`[TCP] YouTube 토큰 조회 실패`, {
        userId: data.userId,
        error: error instanceof Error ? error.message : 'Unknown'
      });

      return {
        success: false,
        error: {
          code: error.code || 'OAUTH_ERROR',
          message: error.message || 'OAuth 토큰 조회 실패'
        }
      };
    }
  }

  /**
   * YouTube 권한 여부 확인 (TCP)
   */
  @MessagePattern('oauth.youtube.hasAccess')
  async hasYouTubeAccess(@Payload() data: { userId: string }) {
    this.logger.debug(`[TCP] oauth.youtube.hasAccess - userId: ${data.userId}`);

    try {
      const hasAccess = await this.oauthTokenService.hasYouTubeAccess(data.userId);

      this.logger.debug(`[TCP] YouTube 권한 확인 완료 - userId: ${data.userId}, hasAccess: ${hasAccess}`);

      return {
        success: true,
        data: { hasAccess }
      };
    } catch (error) {
      this.logger.error(`[TCP] YouTube 권한 확인 실패`, {
        userId: data.userId,
        error: error instanceof Error ? error.message : 'Unknown'
      });

      return {
        success: false,
        error: {
          code: 'OAUTH_ERROR',
          message: error.message || 'YouTube 권한 확인 실패'
        }
      };
    }
  }
}
```

### 2.3 OAuth 모듈 최종 업데이트

**파일**: `src/modules/oauth/oauth.module.ts` (수정)

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EncryptionModule } from '@common/encryption/encryption.module.js';
import { UserModule } from '@modules/user/user.module.js';
import { RedisModule } from '@database/redis/redis.module.js';
import { JwtModule } from '@common/jwt/jwt.module.js';

import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';
import { OAuthRepository } from './oauth.repository.js';
import { GoogleOAuthService } from './google.service.js';
import { NaverOAuthService } from './naver.service.js';
import { OAuthTokenTcpService } from './oauth-token-tcp.service.js';  // ✨ 추가
import { OAuthTokenTcpController } from './oauth-token-tcp.controller.js';  // ✨ 추가
import { OAuthAccountEntity } from './entities/oauth-account.entity.js';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([OAuthAccountEntity]),
    EncryptionModule,
    UserModule,
    RedisModule,
    JwtModule,
  ],
  providers: [
    OAuthService,
    OAuthRepository,
    GoogleOAuthService,
    NaverOAuthService,
    OAuthTokenTcpService,  // ✨ 추가
  ],
  controllers: [
    OAuthController,
    OAuthTokenTcpController,  // ✨ 추가
  ],
  exports: [OAuthService, OAuthTokenTcpService, OAuthRepository],
})
export class OAuthModule {}
```

---

## 📦 Phase 3: 환경 변수 설정

### 3.1 auth-server 환경 변수

**파일**: `envs/.env.local` (수정)

```bash
# 기존 Google OAuth 설정
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=http://localhost:8000/api/oauth/login-google/callback

# ✨ 토큰 암호화 키 (32자 이상 필수)
ENCRYPTION_KEY=your-super-secret-32-character-encryption-key-here!!!
```

**보안 주의사항:**
- `ENCRYPTION_KEY`는 반드시 32자 이상의 랜덤 문자열
- 프로덕션 환경에서는 Kubernetes Secret 사용
- `.env` 파일은 `.gitignore`에 포함되어야 함

---

## 📦 Phase 4: my-pick-server 연동 가이드

### 4.1 YouTube API Service 확장

**파일**: `my-pick-server/src/modules/external-api/services/youtube-api.service.ts` (수정)

```typescript
import { Injectable, Logger, Inject, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';

import { lastValueFrom, map } from 'rxjs';

import { transformAndValidate } from '@krgeobuk/core/utils';

import { ExternalApiException } from '../exceptions/index.js';
import { ApiProvider, ApiOperation } from '../enums/index.js';
import { YouTubeChannelDto, YouTubeVideoDto } from '../dto/index.js';

import { QuotaMonitorService } from './quota-monitor.service.js';

@Injectable()
export class YouTubeApiService {
  private readonly logger = new Logger(YouTubeApiService.name);
  private readonly apiKey: string;  // 공유 API 키 (읽기 전용)
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly quotaMonitor: QuotaMonitorService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy  // ✨ 추가
  ) {
    this.apiKey = this.configService.get<string>('youtube.youtubeApiKey')!;

    if (!this.apiKey) {
      this.logger.error('YouTube API key not configured');
      throw new Error('YouTube API key is required');
    }
  }

  // ==================== 읽기 작업 (공유 API 키 사용) ====================

  /**
   * 채널 정보 조회 - 기존 로직 유지
   */
  async getChannelInfo(channelId: string): Promise<YouTubeChannelDto | null> {
    // 기존 코드 유지 (공유 API 키 사용)
  }

  /**
   * 채널 영상 목록 조회 - 기존 로직 유지
   */
  async getChannelVideos(
    channelId: string,
    options: { maxResults: number; pageToken?: string; publishedAfter?: Date }
  ): Promise<{ videos: YouTubeVideoDto[]; nextPageToken?: string; totalResults: number }> {
    // 기존 코드 유지 (공유 API 키 사용)
  }

  /**
   * 비디오 상세 조회 - 기존 로직 유지
   */
  async getVideoById(videoId: string): Promise<YouTubeVideoDto | null> {
    // 기존 코드 유지 (공유 API 키 사용)
  }

  // ==================== 쓰기 작업 (개인 OAuth 토큰 사용) ====================

  /**
   * 댓글 작성 (실제 YouTube API 호출)
   */
  async insertComment(userId: string, videoId: string, text: string): Promise<any> {
    this.logger.log(`YouTube 댓글 작성 시작 - videoId: ${videoId}, userId: ${userId}`);

    const token = await this.getYouTubeToken(userId);

    try {
      const response = await lastValueFrom(
        this.httpService.post(
          `${this.baseUrl}/commentThreads?part=snippet`,
          {
            snippet: {
              videoId,
              topLevelComment: {
                snippet: {
                  textOriginal: text
                }
              }
            }
          },
          {
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        ).pipe(map(res => res.data))
      );

      this.logger.log(`YouTube 댓글 작성 성공 - commentId: ${response.id}`);
      return response;

    } catch (error) {
      this.logger.error('YouTube 댓글 작성 실패', {
        userId,
        videoId,
        error: error instanceof Error ? error.message : 'Unknown'
      });
      throw ExternalApiException.youtubeApiError();
    }
  }

  /**
   * 좋아요 추가
   */
  async likeVideo(userId: string, videoId: string): Promise<void> {
    this.logger.log(`YouTube 좋아요 추가 시작 - videoId: ${videoId}, userId: ${userId}`);

    const token = await this.getYouTubeToken(userId);

    try {
      await lastValueFrom(
        this.httpService.post(
          `${this.baseUrl}/videos/rate?id=${videoId}&rating=like`,
          null,
          {
            headers: {
              Authorization: `Bearer ${token.accessToken}`
            }
          }
        )
      );

      this.logger.log(`YouTube 좋아요 추가 성공 - videoId: ${videoId}`);

    } catch (error) {
      this.logger.error('YouTube 좋아요 추가 실패', {
        userId,
        videoId,
        error: error instanceof Error ? error.message : 'Unknown'
      });
      throw ExternalApiException.youtubeApiError();
    }
  }

  /**
   * 채널 구독하기
   */
  async subscribeToChannel(userId: string, channelId: string): Promise<void> {
    this.logger.log(`YouTube 채널 구독 시작 - channelId: ${channelId}, userId: ${userId}`);

    const token = await this.getYouTubeToken(userId);

    try {
      await lastValueFrom(
        this.httpService.post(
          `${this.baseUrl}/subscriptions?part=snippet`,
          {
            snippet: {
              resourceId: {
                kind: 'youtube#channel',
                channelId
              }
            }
          },
          {
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      this.logger.log(`YouTube 채널 구독 성공 - channelId: ${channelId}`);

    } catch (error) {
      this.logger.error('YouTube 채널 구독 실패', {
        userId,
        channelId,
        error: error instanceof Error ? error.message : 'Unknown'
      });
      throw ExternalApiException.youtubeApiError();
    }
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * auth-server에서 YouTube 토큰 조회 (TCP)
   */
  private async getYouTubeToken(userId: string): Promise<{ accessToken: string; expiresAt: Date }> {
    try {
      const response = await lastValueFrom(
        this.authClient.send('oauth.youtube.getAccessToken', { userId })
      );

      if (!response.success) {
        this.logger.warn(`YouTube 토큰 조회 실패 - userId: ${userId}`, response.error);
        throw new UnauthorizedException({
          code: response.error.code,
          message: response.error.message
        });
      }

      return response.data;

    } catch (error) {
      this.logger.error('auth-server에서 YouTube 토큰 조회 실패', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown'
      });

      throw new UnauthorizedException({
        code: 'YOUTUBE_AUTH_REQUIRED',
        message: 'YouTube 권한이 필요합니다. Google 로그인을 다시 시도해주세요.'
      });
    }
  }

  // ... 기존 private 메서드들 유지 ...
}
```

### 4.2 Content Controller 댓글/좋아요 엔드포인트 추가

**파일**: `my-pick-server/src/modules/content/content.controller.ts` (수정)

```typescript
import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@common/guards/auth.guard.js';

import { ContentService } from './content.service.js';
import { YouTubeApiService } from '@modules/external-api/services/youtube-api.service.js';

@Controller('content')
export class ContentController {
  constructor(
    private contentService: ContentService,
    private youtubeApi: YouTubeApiService
  ) {}

  // ... 기존 메서드들 ...

  /**
   * YouTube 영상에 댓글 작성 (실제 YouTube API 호출)
   */
  @Post(':id/youtube-comment')
  @UseGuards(AuthGuard)
  async addYouTubeComment(
    @Param('id') contentId: string,
    @Body() dto: { text: string },
    @Req() req: any
  ): Promise<void> {
    const userId = req.user.sub;

    // 1. Content 조회 (videoId 획득)
    const content = await this.contentService.findByIdOrFail(contentId);

    if (content.platform !== 'YOUTUBE') {
      throw new BadRequestException('YouTube 콘텐츠만 댓글 작성이 가능합니다.');
    }

    // 2. 실제 YouTube API 호출 (auth-server에서 토큰 자동 조회)
    await this.youtubeApi.insertComment(userId, content.externalId, dto.text);

    // 3. 로컬 DB 기록 (선택적)
    // await this.userInteractionService.recordComment(userId, contentId, dto.text);
  }

  /**
   * YouTube 영상 좋아요 (실제 YouTube API 호출)
   */
  @Post(':id/youtube-like')
  @UseGuards(AuthGuard)
  async likeYouTubeVideo(
    @Param('id') contentId: string,
    @Req() req: any
  ): Promise<void> {
    const userId = req.user.sub;

    const content = await this.contentService.findByIdOrFail(contentId);

    if (content.platform !== 'YOUTUBE') {
      throw new BadRequestException('YouTube 콘텐츠만 좋아요가 가능합니다.');
    }

    await this.youtubeApi.likeVideo(userId, content.externalId);
  }
}
```

---

## 🚀 Kubernetes 배포 가이드

### Service 정의 (내부 통신)

**파일**: `k8s/auth-server-service.yaml`

```yaml
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
      protocol: TCP
    - name: tcp
      port: 8010      # my-pick-server가 OAuth 토큰 조회에 사용
      targetPort: 8010
      protocol: TCP
  type: ClusterIP   # 클러스터 내부 전용
```

### NetworkPolicy (선택적 보안 강화)

**파일**: `k8s/auth-server-network-policy.yaml`

```yaml
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
    # TCP 포트는 my-pick-server만 접근 허용
    - from:
      - podSelector:
          matchLabels:
            app: my-pick-server
      ports:
        - protocol: TCP
          port: 8010
    # HTTP 포트는 ingress-controller만 접근 허용
    - from:
      - namespaceSelector:
          matchLabels:
            name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8000
```

### Secret 관리

**파일**: `k8s/auth-server-secret.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-server-secrets
  namespace: krgeobuk
type: Opaque
stringData:
  ENCRYPTION_KEY: "your-production-encryption-key-32-chars-minimum!!!"
  GOOGLE_CLIENT_SECRET: "your-google-client-secret"
```

---

## ✅ 구현 체크리스트

### Phase 1: auth-server 토큰 저장 (3-4시간)
- [ ] 암호화 서비스 구현 (`EncryptionService`)
- [ ] 데이터베이스 마이그레이션 실행
- [ ] `OAuthAccountEntity` 확장 (토큰 필드 추가)
- [ ] `oauth.controller.ts` 스코프 확장 (`youtube.force-ssl` 추가)
- [ ] `oauth.service.ts` 토큰 저장 로직 구현
- [ ] 환경 변수 설정 (`ENCRYPTION_KEY`)
- [ ] 로컬 테스트: Google 로그인 후 DB에 토큰 저장 확인

### Phase 2: auth-server TCP API (2-3시간)
- [ ] `OAuthTokenTcpService` 구현 (토큰 조회, 자동 갱신)
- [ ] `OAuthTokenTcpController` 구현 (TCP 메시지 패턴)
- [ ] `OAuthModule` 의존성 추가
- [ ] 로컬 테스트: TCP 클라이언트로 토큰 조회 확인

### Phase 3: my-pick-server 연동 (2-3시간)
- [ ] `YouTubeApiService` 확장 (댓글, 좋아요 메서드 추가)
- [ ] `ContentController` 엔드포인트 추가
- [ ] 통합 테스트: 실제 YouTube 댓글 작성 확인
- [ ] 에러 처리 테스트 (토큰 없음, 만료 등)

### Phase 4: 배포 준비 (1-2시간)
- [ ] Kubernetes Secret 생성 (`ENCRYPTION_KEY`)
- [ ] Service YAML 작성 및 적용
- [ ] NetworkPolicy 적용 (선택)
- [ ] 프로덕션 환경 테스트

---

## 🔒 보안 고려사항

### 1. 토큰 암호화
- ✅ AES-256-CBC 알고리즘 사용
- ✅ 환경 변수로 암호화 키 관리 (Git 제외)
- ✅ Kubernetes Secret으로 프로덕션 키 관리

### 2. 네트워크 보안
- ✅ ClusterIP로 내부 통신만 허용
- ✅ NetworkPolicy로 접근 제어 (my-pick-server만 TCP 접근)
- ✅ 필요 시 mTLS 적용 가능

### 3. 토큰 관리
- ✅ 만료 5분 전 자동 갱신
- ✅ Refresh Token 안전 저장
- ✅ 토큰 조회 시 복호화 (메모리에서만 존재)

### 4. 감사 로그
- ✅ 모든 토큰 조회/갱신 로깅
- ✅ 실패 케이스 상세 로깅
- ✅ Winston 구조화된 로그 사용

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

## 🎯 향후 확장 계획

### Twitter API 연동
- 동일한 패턴으로 Twitter OAuth 토큰 저장
- `oauth_account` 테이블 재사용
- TCP 메시지 패턴: `oauth.twitter.getAccessToken`

### Instagram API 연동
- Facebook Graph API OAuth 토큰 저장
- 동일한 암호화 서비스 재사용

### 멀티 플랫폼 지원
- 사용자별로 여러 플랫폼 토큰 관리
- `provider` 필드로 구분 (GOOGLE, TWITTER, FACEBOOK 등)

---

## 📞 문제 해결 가이드

### 토큰 조회 실패 (`OAUTH_TOKEN_NOT_FOUND`)
**원인**: 사용자가 Google 로그인을 하지 않았거나, OAuth 토큰이 저장되지 않음
**해결**: 사용자에게 다시 Google 로그인 요청

### 토큰 갱신 실패 (`TOKEN_REFRESH_FAILED`)
**원인**: Refresh Token이 만료되었거나 Google에서 토큰 폐기됨
**해결**: 사용자에게 다시 Google 로그인 요청

### YouTube API 호출 실패 (403 Forbidden)
**원인**: YouTube API 스코프가 없거나, 할당량 초과
**해결**:
1. `scopes` 필드 확인 (`youtube.force-ssl` 포함 여부)
2. Google Cloud Console에서 할당량 확인
3. 필요 시 할당량 증가 요청

### 암호화 키 오류
**원인**: `ENCRYPTION_KEY`가 설정되지 않았거나 32자 미만
**해결**: `.env` 파일에 32자 이상의 키 설정

---

## 🔗 참고 문서

- [YouTube Data API v3 - OAuth 2.0](https://developers.google.com/youtube/v3/guides/authentication)
- [Google OAuth 2.0 - Refresh Token](https://developers.google.com/identity/protocols/oauth2/web-server#offline)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/)

---

## 📝 개발 시작 전 준비사항

1. **Google Cloud Console 설정**
   - YouTube Data API v3 활성화
   - OAuth 2.0 클라이언트 ID 생성
   - Redirect URI 설정: `http://localhost:8000/api/oauth/login-google/callback`
   - 스코프 추가: `https://www.googleapis.com/auth/youtube.force-ssl`

2. **환경 변수 설정**
   - `ENCRYPTION_KEY` 32자 이상 랜덤 문자열 생성
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 설정

3. **데이터베이스 백업**
   - 마이그레이션 전 `oauth_account` 테이블 백업

4. **의존성 확인**
   - `crypto` 모듈 (Node.js 내장)
   - `@nestjs/axios`, `rxjs` 버전 확인

---

**작성일**: 2025-11-11
**작성자**: Claude Code
**버전**: 1.0
**상태**: 구현 대기 중
