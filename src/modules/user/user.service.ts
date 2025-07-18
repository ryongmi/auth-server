import { Injectable, Logger } from '@nestjs/common';

import { EntityManager, FindOptionsWhere, UpdateResult, In } from 'typeorm';

import { UserException } from '@krgeobuk/user/exception';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import type {
  UserFilter,
  UserSearchQuery,
  ChangePassword,
  UpdateMyProfile,
  UserSearchResult,
  UserDetail,
} from '@krgeobuk/user/interfaces';

import { hashPassword, isPasswordMatching } from '@common/utils/index.js';

import { UserEntity } from './entities/user.entity.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepo: UserRepository) {}

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
    return await this.userRepo.findUserProfile(userId);
  }

  async getMyProfile(userId: string): Promise<UserDetail> {
    return await this.userRepo.findUserProfile(userId);
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
}
