import { Injectable } from '@nestjs/common';
import { EntityManager, UpdateResult } from 'typeorm';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import type {
  SearchQuery,
  ChangePassword,
  UpdateMyProfile,
  SearchResult,
  Detail,
} from '@krgeobuk/user/interfaces';
import { UserException } from '@krgeobuk/user/exception';

import { hashPassword, isPasswordMatching } from '@common/utils/index.js';

import { User } from './entities/user.entity.js';
import { UserRepository } from './user.repositoty.js';

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async searchUsers(query: SearchQuery): Promise<PaginatedResult<SearchResult>> {
    return this.userRepo.search(query);
  }

  // async getUsers(query: SearchQuery): Promise<PaginatedResult<SearchResult>> {
  //   return this.userRepo.search(query);
  // }

  async findUserById(id: string): Promise<User | null> {
    return this.userRepo.findOneById(id);
  }

  async findUserByEmail(email: string | null): Promise<User | null> {
    if (!email) {
      return null;
    }

    return this.userRepo.findOne({
      where: { email },
    });
  }

  async findUsersByUsername(name: string): Promise<User[] | undefined> {
    return this.userRepo.find({ where: { name } });
  }

  async findUserByUserIdOREmail(id: string, email: string): Promise<User[] | undefined> {
    return this.userRepo.find({ where: [{ id }, { email }] });
  }

  async getUserProfile(id: string): Promise<Detail> {
    return await this.userRepo.findUserProfile(id);
  }

  async getMyProfile(id: string): Promise<Detail> {
    return await this.userRepo.findUserProfile(id);
  }

  async updateMyProfile(id: string, attrs: UpdateMyProfile): Promise<void> {
    const user = await this.findUserById(id);
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

    const user = await this.findUserById(id);
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
