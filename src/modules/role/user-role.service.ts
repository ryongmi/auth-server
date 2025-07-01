import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, FindOptionsWhere, In, UpdateResult } from 'typeorm';
// import { EntityManager } from 'typeorm';

// import type { PaginatedResult } from '@krgeobuk/core/interfaces';
// import type { ListQuery } from '@krgeobuk/user/interfaces';

import { UserRoleEntity } from './entities/user-role.entity.js';
import { UserRoleRepository } from './user-role.repositoty.js';

interface Filter {
  userId?: string;
  roleId?: string;
}

@Injectable()
export class UserRoleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userRoleRepo: UserRoleRepository
  ) {}

  async findByUserId(userId: string): Promise<UserRoleEntity[]> {
    return this.userRoleRepo.find({ where: { userId } });
  }

  async findByRoleId(roleId: string): Promise<UserRoleEntity[]> {
    return this.userRoleRepo.find({ where: { roleId } });
  }

  async findByUserIds(userIds: string[]): Promise<UserRoleEntity[]> {
    return this.userRoleRepo.find({ where: { userId: In(userIds) } });
  }

  async findByRoleIds(roleIds: string[]): Promise<UserRoleEntity[]> {
    return this.userRoleRepo.find({ where: { roleId: In(roleIds) } });
  }

  async findByAnd(filter: Filter = {}): Promise<UserRoleEntity[]> {
    const where: FindOptionsWhere<UserRoleEntity> = {};

    if (filter.userId) where.userId = filter.userId;
    if (filter.roleId) where.roleId = filter.roleId;

    // ✅ 필터 없으면 전체 조회
    if (Object.keys(where).length === 0) {
      return this.userRoleRepo.find(); // 조건 없이 전체 조회
    }

    return this.userRoleRepo.find({ where });
  }

  async findByOr(filter: Filter = {}): Promise<UserRoleEntity[]> {
    const { userId, roleId } = filter;

    const where: FindOptionsWhere<UserRoleEntity>[] = [];

    if (userId) where.push({ userId });
    if (roleId) where.push({ roleId });

    // ✅ 필터 없으면 전체 조회
    if (where.length === 0) {
      return this.userRoleRepo.find(); // 조건 없이 전체 조회
    }

    return this.userRoleRepo.find({ where });
  }

  async createUserRole(
    attrs: Partial<UserRoleEntity>,
    transactionManager?: EntityManager
  ): Promise<UserRoleEntity> {
    const userRoleEntity = new UserRoleEntity();

    Object.assign(userRoleEntity, attrs);

    return this.userRoleRepo.saveEntity(userRoleEntity, transactionManager);
  }

  async updateUserRole(
    userRoleEntity: UserRoleEntity,
    transactionManager?: EntityManager
  ): Promise<UpdateResult> {
    return this.userRoleRepo.updateEntity(userRoleEntity, transactionManager);
  }

  async deleteUserRole(id: string): Promise<UpdateResult> {
    return this.userRoleRepo.softDelete(id);
  }
}
