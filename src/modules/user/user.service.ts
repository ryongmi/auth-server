import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { EntityManager, FindOptionsWhere, UpdateResult, In } from 'typeorm';
import { firstValueFrom } from 'rxjs';

import { UserException } from '@krgeobuk/user/exception';
import { ServiceTcpPatterns } from '@krgeobuk/service/tcp';
import { AuthorizationTcpPatterns } from '@krgeobuk/authorization/tcp';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import type {
  UserFilter,
  UserSearchQuery,
  ChangePassword,
  UpdateMyProfile,
  UserSearchResult,
  UserDetail,
} from '@krgeobuk/user/interfaces';
import type { UserProfile } from '@krgeobuk/user/interfaces';
import type { Service } from '@krgeobuk/shared/service';

import { hashPassword, isPasswordMatching } from '@common/utils/index.js';
import { convertToProxyUrl } from '@/utils/imageUrlUtils.js';

import { UserEntity } from './entities/user.entity.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    @Inject('AUTHZ_SERVICE') private readonly authzClient: ClientProxy,
    @Inject('PORTAL_SERVICE') private readonly portalClient: ClientProxy
  ) {}

  async searchUsers(query: UserSearchQuery): Promise<PaginatedResult<UserSearchResult>> {
    return this.userRepo.search(query);
  }

  async findById(userId: string): Promise<UserEntity | null> {
    return this.userRepo.findOneById(userId);
  }

  async findByAnd(filter: UserFilter = {}): Promise<UserEntity[]> {
    const where: FindOptionsWhere<UserEntity> = {};

    if (filter.email) where.email = filter.email;
    if (filter.name) where.name = filter.name;
    if (filter.nickname) where.nickname = filter.nickname;
    if (filter.profileImageUrl) where.profileImageUrl = filter.profileImageUrl;
    if (filter.isEmailVerified) where.isEmailVerified = filter.isEmailVerified;
    if (filter.isIntegrated) where.isIntegrated = filter.isIntegrated;

    // ✅ 필터 없으면 전체 조회
    if (Object.keys(where).length === 0) {
      return this.userRepo.find(); // 조건 없이 전체 조회
    }

    return this.userRepo.find({ where });
  }

  async findByOr(filter: UserFilter = {}): Promise<UserEntity[]> {
    const { email, name, nickname, profileImageUrl, isEmailVerified, isIntegrated } = filter;

    const where: FindOptionsWhere<UserEntity>[] = [];

    if (email) where.push({ email });
    if (name) where.push({ name });
    if (nickname) where.push({ nickname });
    if (profileImageUrl) where.push({ profileImageUrl });
    if (isEmailVerified) where.push({ isEmailVerified });
    if (isIntegrated) where.push({ isIntegrated });

    // ✅ 필터 없으면 전체 조회
    if (where.length === 0) {
      return this.userRepo.find(); // 조건 없이 전체 조회
    }

    return this.userRepo.find({ where });
  }

  async getUserProfile(userId: string): Promise<UserDetail> {
    const userDetail = await this.userRepo.findUserProfile(userId);

    // profileImageUrl을 프록시 URL로 변환
    return {
      ...userDetail,
      profileImageUrl: convertToProxyUrl(userDetail.profileImageUrl),
    };
  }

  async getMyProfile(userId?: string): Promise<UserProfile> {
    // 비로그인 사용자인 경우 기본 정보만 반환
    if (!userId || userId.trim() === '') {
      this.logger.debug('비로그인 사용자 프로필 요청');

      return await this.getGuestProfile();
    }

    let baseUser: UserDetail;

    try {
      // 1. 기본 사용자 정보 조회 (OAuth 포함)
      baseUser = await this.userRepo.findUserProfile(userId);
    } catch (error: unknown) {
      // 내부 에러: 사용자 조회 실패 - 예외 발생
      this.logger.error('사용자 기본 정보 조회 실패', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw UserException.profileFetchError();
    }

    try {
      // 2. authz-server에서 권한/역할 정보 조회 (병렬 처리)
      // TCP 에러는 각 메서드 내부에서 처리되어 빈 배열/null 반환
      const [roles, permissions, availableServices] = await Promise.all([
        this.getUserRoles(userId),
        this.getUserPermissions(userId),
        this.getAvailableServices(userId),
      ]);

      // 3. 통합 결과 반환
      const result: UserProfile = {
        ...baseUser,
        profileImageUrl: convertToProxyUrl(baseUser.profileImageUrl), // 프록시 URL로 변환
        authorization: {
          roles,
          permissions,
        },
        availableServices: availableServices,
      };

      this.logger.log('통합 사용자 프로필 조회 성공', {
        userId,
        provider: baseUser.oauthAccount.provider,
        hasGoogleAccount: baseUser.oauthAccount.provider === 'google',
        roleCount: roles.length,
        permissionCount: permissions.length,
        serviceCount: availableServices?.length || 0,
        tcpServicesAvailable: {
          roles: roles.length > 0,
          permissions: permissions.length > 0,
          services: availableServices.length > 0,
        },
      });

      return result;
    } catch (error: unknown) {
      // 예상치 못한 에러: TCP 호출 중 치명적 에러
      this.logger.error('통합 사용자 프로필 조회 중 예상치 못한 에러 발생', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Fallback: 기본 사용자 정보만 반환 (이미 조회 완료)
      return {
        ...baseUser,
        profileImageUrl: convertToProxyUrl(baseUser.profileImageUrl), // 프록시 URL로 변환
        authorization: { roles: [], permissions: [] },
        availableServices: [],
      };
    }
  }

  async updateMyProfile(userId: string, attrs: UpdateMyProfile): Promise<void> {
    const user = await this.findById(userId);
    if (!user) throw UserException.userNotFound();

    Object.assign(user, attrs);

    try {
      await this.updateUser(user);
    } catch (error: unknown) {
      // 내부 로그: 프로필 업데이트 에러 상세 정보
      const internalMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(
        `[USER_PROFILE_UPDATE_ERROR] 프로필 업데이트 실패 - Internal: ${internalMessage}`,
        {
          action: 'updateMyProfile',
          userId: user.id,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          stack,
        }
      );

      // 클라이언트용: 일반화된 에러 메시지
      throw UserException.profileUpdateError();
    }
  }

  async changePassword(userId: string, attrs: ChangePassword): Promise<void> {
    const { newPassword, currentPassword } = attrs;

    const user = await this.findById(userId);
    if (!user) throw UserException.userNotFound();

    const isMatch = isPasswordMatching(currentPassword, user.password ?? '');
    if (!isMatch) throw UserException.passwordIncorrect();

    const hashedPassword = await hashPassword(newPassword);

    Object.assign(user, { password: hashedPassword });

    try {
      await this.updateUser(user);
    } catch (error: unknown) {
      // 내부 로그: 비밀번호 변경 에러 상세 정보
      const internalMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(
        `[USER_PASSWORD_CHANGE_ERROR] 비밀번호 변경 실패 - Internal: ${internalMessage}`,
        {
          action: 'changePassword',
          userId: userId,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          stack,
        }
      );

      // 클라이언트용: 일반화된 에러 메시지
      throw UserException.passwordChangeError();
    }
  }

  async deleteMyAccount(userId: string): Promise<void> {
    try {
      const result = await this.deleteUser(userId);
      if (!result.affected || result.affected <= 0) {
        throw new Error('해당 유저 미존재 또는 삭제 실패');
      }
    } catch (error: unknown) {
      // 내부 로그: 계정 삭제 에러 상세 정보
      const internalMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(
        `[USER_ACCOUNT_DELETE_ERROR] 계정 삭제 실패 - Internal: ${internalMessage}`,
        {
          action: 'deleteMyAccount',
          userId: userId,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          stack,
        }
      );

      // 클라이언트용: 일반화된 에러 메시지
      throw UserException.accountDeleteError();
    }
  }

  // TCP 통신 헬퍼 메서드
  private async getUserRoles(userId: string): Promise<string[]> {
    try {
      if (!this.authzClient) return [];
      const result = await firstValueFrom<string[]>(
        this.authzClient.send(AuthorizationTcpPatterns.GET_USER_ROLE_NAMES, { userId })
      );

      return result || [];
    } catch (error: unknown) {
      this.logger.warn('Authz service unavailable for getUserRoles', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return [];
    }
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    try {
      if (!this.authzClient) return [];
      const result = await firstValueFrom<string[]>(
        this.authzClient.send(AuthorizationTcpPatterns.GET_USER_PERMISSION_ACTIONS, { userId })
      );

      return result || [];
    } catch (error: unknown) {
      this.logger.warn('Authz service unavailable for getUserPermissions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return [];
    }
  }

  private async getAvailableServices(userId: string): Promise<Service[]> {
    try {
      if (!this.authzClient) return [];
      const result = await firstValueFrom<Service[]>(
        this.authzClient.send(AuthorizationTcpPatterns.GET_AVAILABLE_SERVICES, { userId })
      );
      return result || [];
    } catch (error: unknown) {
      this.logger.warn('Authz service unavailable for getAvailableServices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return [];
    }
  }

  /**
   * 모든 서비스 목록 조회 (portal-server TCP 통신)
   */
  private async getAllServices(): Promise<Service[]> {
    try {
      if (!this.portalClient) {
        this.logger.warn('Portal service client not available, using fallback data');
        return [];
      }

      const services = await firstValueFrom<Service[]>(
        this.portalClient.send(ServiceTcpPatterns.FIND_ALL, {})
      );

      this.logger.debug('Portal service에서 서비스 목록 조회 성공', {
        serviceCount: services?.length || 0,
      });

      return services || [];
    } catch (error: unknown) {
      this.logger.warn('portal-server에서 서비스 목록 조회 실패, 임시 데이터 사용', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // 폴백: 임시 데이터 반환
      return [];
    }
  }

  // async lastLoginUpdate(id: string) {
  //   // return await this.repo.save(attrs);
  //   // await this.repo
  //   //   .createQueryBuilder()
  //   //   .update(User)
  //   //   .set({ lastLogin: new Date() })
  //   //   .where('id = :id', { id })
  //   //   .execute();
  // }

  async createUser(
    attrs: Partial<UserEntity>,
    transactionManager?: EntityManager
  ): Promise<UserEntity> {
    const userEntity = new UserEntity();

    Object.assign(userEntity, attrs);

    return this.userRepo.saveEntity(userEntity, transactionManager);
  }

  async updateUser(
    userEntity: UserEntity,
    transactionManager?: EntityManager
  ): Promise<UpdateResult> {
    return this.userRepo.updateEntity(userEntity, transactionManager);
  }

  async deleteUser(userId: string): Promise<UpdateResult> {
    return this.userRepo.softDelete(userId);
  }

  /**
   * TCP 컨트롤러용 추가 메서드들
   */

  async getUserDetailById(userId: string): Promise<UserDetail | null> {
    try {
      return await this.userRepo.findUserProfile(userId);
    } catch (error) {
      this.logger.error(`Error getting user detail by ID ${userId}:`, error);
      return null;
    }
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findByIds(userIds: string[]): Promise<UserEntity[]> {
    if (userIds.length === 0) return [];
    return this.userRepo.find({ where: { id: In(userIds) } });
  }

  async countUsers(filter?: UserFilter): Promise<number> {
    if (!filter || Object.keys(filter).length === 0) {
      return this.userRepo.count();
    }

    const where: FindOptionsWhere<UserEntity> = {};
    if (filter.email) where.email = filter.email;
    if (filter.name) where.name = filter.name;
    if (filter.nickname) where.nickname = filter.nickname;
    if (filter.profileImageUrl) where.profileImageUrl = filter.profileImageUrl;
    if (filter.isEmailVerified !== undefined) where.isEmailVerified = filter.isEmailVerified;
    if (filter.isIntegrated !== undefined) where.isIntegrated = filter.isIntegrated;

    return this.userRepo.count({ where });
  }

  /**
   * 비로그인 사용자(게스트)를 위한 기본 프로필 반환
   * 사용자 정보 없이 공개 서비스 목록만 제공 (TCP 통신으로 실제 데이터 조회)
   */
  private async getGuestProfile(): Promise<UserProfile> {
    try {
      // 실제 서비스 데이터를 portal-server에서 TCP 통신으로 조회
      const allServices = await this.getAllServices();

      // 게스트가 접근 가능한 서비스만 필터링 (isVisible=true && isVisibleByRole=false)
      const publicServices = allServices.filter(
        (service) => service.isVisible && !service.isVisibleByRole
      );

      const guestProfile: UserProfile = {
        id: '',
        email: '',
        name: '',
        nickname: null,
        profileImageUrl: null,
        isIntegrated: false,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),

        // OAuth 정보 - 기본값
        oauthAccount: {
          id: '',
          provider: 'homePage',
          providerId: '',
        },

        // 권한 정보 - 빈 배열
        authorization: {
          roles: [],
          permissions: [],
        },

        // 공개 서비스만 제공 (권한 검사 없이)
        availableServices: publicServices,
      };

      this.logger.debug('게스트 프로필 조회 성공', {
        totalServices: allServices.length,
        publicServices: publicServices.length,
        publicServiceNames: publicServices.map((s) => s.name),
        tcpCallAvoided: true, // TCP 통신 없이 처리됨
      });

      return guestProfile;
    } catch (error: unknown) {
      this.logger.error('게스트 프로필 조회 실패', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // 완전 폴백: 빈 프로필 반환
      return {
        id: '',
        email: '',
        name: '',
        nickname: null,
        profileImageUrl: null,
        isIntegrated: false,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        oauthAccount: {
          id: '',
          provider: 'homePage',
          providerId: '',
        },
        authorization: {
          roles: [],
          permissions: [],
        },
        availableServices: [],
      };
    }
  }
}
