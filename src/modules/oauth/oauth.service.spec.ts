import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { EntityManager } from 'typeorm';

import { OAuthException } from '@krgeobuk/oauth/exception';
import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';

import { UserService } from '@modules/user/user.service';
import { RedisService } from '@database/redis/redis.service';
import { JwtTokenService } from '@common/jwt/jwt-token.service';

import { OAuthService } from './oauth.service';
import { OAuthRepository } from './oauth.repository';
import { GoogleOAuthService } from './google.service';
import { NaverOAuthService } from './naver.service';

describe('OAuthService', () => {
  let service: OAuthService;
  let userService: jest.Mocked<UserService>;
  let oauthRepo: jest.Mocked<OAuthRepository>;

  beforeEach(async () => {
    const mockUserService = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      findById: jest.fn(),
    };

    const mockOAuthRepo = {
      find: jest.fn(),
      findOneById: jest.fn(),
      saveEntity: jest.fn(),
      updateEntity: jest.fn(),
      delete: jest.fn(),
    };

    const mockJwtTokenService = {
      signAccessTokenAndRefreshToken: jest.fn(),
      setRefreshTokenToCookie: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockRedisService = {
      getOAuthState: jest.fn(),
      setOAuthState: jest.fn(),
      deleteOAuthState: jest.fn(),
    };

    const mockGoogleOAuthService = {
      getGoogleUserInfo: jest.fn(),
    };

    const mockNaverOAuthService = {
      getNaverUserInfo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: OAuthRepository, useValue: mockOAuthRepo },
        { provide: JwtTokenService, useValue: mockJwtTokenService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: GoogleOAuthService, useValue: mockGoogleOAuthService },
        { provide: NaverOAuthService, useValue: mockNaverOAuthService },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
    userService = module.get(UserService);
    oauthRepo = module.get(OAuthRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('oauthLogin - 이메일 중복 처리', () => {
    const mockTransactionManager = {} as EntityManager;
    const mockTokenData = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
    };

    describe('시나리오 1: 기존 이메일(비밀번호 있음) + OAuth 시도', () => {
      it('이메일/비밀번호로 가입된 계정에 OAuth 로그인 시 에러 발생', async () => {
        // Given: 이미 가입된 사용자 (비밀번호 있음)
        const existingUser = {
          id: 'user-1',
          email: 'test@gmail.com',
          password: 'hashed_password',
          name: '홍길동',
          isEmailVerified: true,
        };

        const googleUserInfo = {
          id: 'google-123456',
          email: 'test@gmail.com',
          name: '홍길동',
          verifiedEmail: true,
          givenName: '길동',
          picture: 'https://example.com/photo.jpg',
        };

        // Mock 설정
        oauthRepo.find.mockResolvedValueOnce([]); // providerId로 조회: 없음
        userService.findByEmail.mockResolvedValueOnce(existingUser);
        oauthRepo.find.mockResolvedValueOnce([]); // userId로 OAuth 계정 조회: 없음

        // When & Then: 에러 발생 및 에러 상세 확인
        try {
          await service['oauthLogin'](
            googleUserInfo,
            OAuthAccountProviderType.GOOGLE,
            mockTokenData,
            mockTransactionManager
          );
          fail('예외가 발생해야 합니다');
        } catch (error: any) {
          // NestJS HttpException structure
          const response = error.getResponse();
          const status = error.getStatus();

          expect(status).toBe(409);
          expect(response.code).toBe('OAUTH_205');
          expect(response.message).toContain('test@gmail.com');
          expect(response.details.email).toBe('test@gmail.com');
          expect(response.details.attemptedProvider).toBe('google');
          expect(response.details.availableLoginMethods).toContain('email');
          expect(response.details.suggestion).toContain('Google 연동이 가능합니다');
        }

        // findByEmail이 호출되었는지 확인
        expect(userService.findByEmail).toHaveBeenCalledWith('test@gmail.com');
      });
    });

    describe('시나리오 2: 기존 OAuth 계정 + 다른 OAuth 시도', () => {
      it('Naver로 가입된 계정에 Google OAuth 로그인 시 에러 발생', async () => {
        // Given: Naver로 가입된 사용자
        const existingUser = {
          id: 'user-1',
          email: 'test@naver.com',
          password: null, // 비밀번호 없음 (순수 OAuth 가입)
          name: '홍길동',
          isEmailVerified: true,
        };

        const naverOAuthAccount = {
          id: 'oauth-1',
          userId: 'user-1',
          provider: OAuthAccountProviderType.NAVER,
          providerId: 'naver-123',
          accessToken: 'naver-token',
        };

        const googleUserInfo = {
          id: 'google-456',
          email: 'test@naver.com', // 같은 이메일
          name: '홍길동',
          verifiedEmail: true,
          givenName: '길동',
          picture: 'https://example.com/photo.jpg',
        };

        // Mock 설정
        oauthRepo.find.mockResolvedValueOnce([]); // Google providerId 조회: 없음
        userService.findByEmail.mockResolvedValueOnce(existingUser);
        oauthRepo.find.mockResolvedValueOnce([naverOAuthAccount]); // userId로 Naver 계정 조회

        // When & Then: 에러 발생 + Naver 로그인 안내
        try {
          await service['oauthLogin'](
            googleUserInfo,
            OAuthAccountProviderType.GOOGLE,
            mockTokenData,
            mockTransactionManager
          );
          fail('예외가 발생해야 합니다');
        } catch (error: any) {
          const response = error.getResponse();
          expect(response.code).toBe('OAUTH_205');
          expect(response.details.availableLoginMethods).toContain('naver');
          expect(response.details.availableLoginMethods).not.toContain('email');
        }
      });
    });

    describe('시나리오 3: 이메일 + OAuth 혼합', () => {
      it('이메일 가입 + Naver 연동 후 Google OAuth 시도 시 에러 발생', async () => {
        // Given: 이메일 가입 + Naver 연동 완료
        const existingUser = {
          id: 'user-1',
          email: 'test@gmail.com',
          password: 'hashed_password', // 비밀번호 있음
          name: '홍길동',
          isEmailVerified: true,
        };

        const naverOAuthAccount = {
          id: 'oauth-1',
          userId: 'user-1',
          provider: OAuthAccountProviderType.NAVER,
          providerId: 'naver-123',
        };

        const googleUserInfo = {
          id: 'google-789',
          email: 'test@gmail.com',
          name: '홍길동',
          verifiedEmail: true,
          givenName: '길동',
          picture: 'https://example.com/photo.jpg',
        };

        // Mock 설정
        oauthRepo.find.mockResolvedValueOnce([]); // Google providerId 조회: 없음
        userService.findByEmail.mockResolvedValueOnce(existingUser);
        oauthRepo.find.mockResolvedValueOnce([naverOAuthAccount]); // Naver 계정 있음

        // When & Then: 에러 발생 + email, naver 둘 다 안내
        try {
          await service['oauthLogin'](
            googleUserInfo,
            OAuthAccountProviderType.GOOGLE,
            mockTokenData,
            mockTransactionManager
          );
          fail('예외가 발생해야 합니다');
        } catch (error: any) {
          const response = error.getResponse();
          expect(response.code).toBe('OAUTH_205');
          expect(response.details.availableLoginMethods).toContain('email');
          expect(response.details.availableLoginMethods).toContain('naver');
        }
      });
    });

    describe('시나리오 4: 정상 케이스', () => {
      it('이메일 중복 없으면 정상 가입 진행', async () => {
        // Given: 신규 이메일
        const newUserInfo = {
          id: 'google-999',
          email: 'new@gmail.com',
          name: '김철수',
          verifiedEmail: true,
          givenName: '철수',
          picture: 'https://example.com/photo.jpg',
        };

        const createdUser = {
          id: 'user-new',
          email: 'new@gmail.com',
          name: '김철수',
          isEmailVerified: true,
        };

        const createdOAuthAccount = {
          id: 'oauth-new',
          userId: 'user-new',
          provider: OAuthAccountProviderType.GOOGLE,
          providerId: 'google-999',
        };

        // Mock 설정
        oauthRepo.find.mockResolvedValueOnce([]); // providerId 조회: 없음
        userService.findByEmail.mockResolvedValueOnce(null); // 이메일 중복 없음
        userService.createUser.mockResolvedValueOnce(createdUser);
        oauthRepo.saveEntity.mockResolvedValueOnce(createdOAuthAccount);

        // When: OAuth 로그인
        const result = await service['oauthLogin'](
          newUserInfo,
          OAuthAccountProviderType.GOOGLE,
          mockTokenData,
          mockTransactionManager
        );

        // Then: 정상 가입
        expect(userService.createUser).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'new@gmail.com' }),
          mockTransactionManager
        );
        expect(oauthRepo.saveEntity).toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(result.email).toBe('new@gmail.com');
      });
    });

    describe('시나리오 5: 기존 OAuth 계정 로그인', () => {
      it('이미 등록된 OAuth 계정으로 로그인 시 정상 처리', async () => {
        // Given: 이미 등록된 OAuth 계정
        const existingOAuthAccount = {
          id: 'oauth-1',
          userId: 'user-1',
          provider: OAuthAccountProviderType.GOOGLE,
          providerId: 'google-123',
          accessToken: 'old-token',
        };

        const existingUser = {
          id: 'user-1',
          email: 'test@gmail.com',
          name: '홍길동',
        };

        const googleUserInfo = {
          id: 'google-123', // 기존 providerId
          email: 'test@gmail.com',
          name: '홍길동',
          verifiedEmail: true,
          givenName: '길동',
          picture: 'https://example.com/photo.jpg',
        };

        // Mock 설정
        oauthRepo.find.mockResolvedValueOnce([existingOAuthAccount]); // providerId 조회: 있음
        userService.findById.mockResolvedValueOnce(existingUser);
        oauthRepo.updateEntity.mockResolvedValueOnce({});

        // When: OAuth 로그인
        const result = await service['oauthLogin'](
          googleUserInfo,
          OAuthAccountProviderType.GOOGLE,
          mockTokenData,
          mockTransactionManager
        );

        // Then: 정상 로그인 (토큰 업데이트)
        expect(oauthRepo.updateEntity).toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(result.id).toBe('user-1');
        expect(userService.findByEmail).not.toHaveBeenCalled(); // 이메일 중복 체크 안 함
      });
    });
  });

  describe('findByAnd', () => {
    it('userId로 OAuth 계정 조회', async () => {
      const mockAccounts = [
        { id: 'oauth-1', userId: 'user-1', provider: 'google' },
        { id: 'oauth-2', userId: 'user-1', provider: 'naver' },
      ];

      oauthRepo.find.mockResolvedValueOnce(mockAccounts);

      const result = await service.findByAnd({ userId: 'user-1' });

      expect(result).toEqual(mockAccounts);
      expect(oauthRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });
});
