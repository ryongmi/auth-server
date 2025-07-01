import { Injectable } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, UpdateResult } from 'typeorm';

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

import { User } from './entities/user.entity.js';
import { UserRepository } from './user.repositoty.js';

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async searchUsers(query: UserSearchQuery): Promise<PaginatedResult<UserSearchResult>> {
    return this.userRepo.search(query);
  }

  // async getUsers(query: UserSearchQuery): Promise<PaginatedResult<UserSearchResult>> {
  //   return this.userRepo.search(query);
  // }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOneById(id);
  }

  // async findUserIds(userIds: string[]): Promise<User[]> {
  //   return this.userRepo.find({ where: { userId: In(userIds) } });
  // }

  async findByAnd(filter: UserFilter = {}): Promise<User[]> {
    const where: FindOptionsWhere<User> = {};

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

  async findByOr(filter: UserFilter = {}): Promise<User[]> {
    const { email, name, nickname, profileImageUrl, isEmailVerified, isIntegrated } = filter;

    const where: FindOptionsWhere<User>[] = [];

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

  async getUserProfile(id: string): Promise<UserDetail> {
    return await this.userRepo.findUserProfile(id);
  }

  async getMyProfile(id: string): Promise<UserDetail> {
    return await this.userRepo.findUserProfile(id);
  }

  async updateMyProfile(id: string, attrs: UpdateMyProfile): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw UserException.userNotFound();

    Object.assign(user, attrs);

    try {
      await this.updateUser(user);
    } catch (error: unknown) {
      console.log(`${this.updateMyProfile.name} Error : ${error}`);

      throw UserException.profileUpdateError();
    }
  }

  async changePassword(id: string, attrs: ChangePassword): Promise<void> {
    const { newPassword, currentPassword } = attrs;

    const user = await this.findById(id);
    if (!user) throw UserException.userNotFound();

    const isMatch = isPasswordMatching(currentPassword, user.password ?? '');
    if (!isMatch) throw UserException.passwordIncorrect();

    const hashedPassword = await hashPassword(newPassword);

    Object.assign(user, { password: hashedPassword });

    try {
      await this.updateUser(user);
    } catch (error: unknown) {
      console.log(`${this.changePassword.name} Error : ${error}`);

      throw UserException.passwordChangeError();
    }
  }

  async deleteMyAccount(id: string): Promise<void> {
    try {
      const result = await this.deleteUser(id);
      if (!result.affected || result.affected <= 0) {
        throw new Error('해당 유저 미존재 또는 삭제 실패');
      }
    } catch (error: unknown) {
      console.log(`${this.deleteMyAccount.name} Error : ${error}`);

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

  async createUser(attrs: Partial<User>, transactionManager?: EntityManager): Promise<User> {
    const userEntity = new User();

    Object.assign(userEntity, attrs);

    return this.userRepo.saveEntity(userEntity, transactionManager);
  }

  async updateUser(userEntity: User, transactionManager?: EntityManager): Promise<UpdateResult> {
    return this.userRepo.updateEntity(userEntity, transactionManager);
  }

  async deleteUser(id: string): Promise<UpdateResult> {
    return this.userRepo.softDelete(id);
  }
}
