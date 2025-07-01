import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, FindOptionsWhere, In, UpdateResult } from 'typeorm';
// import { EntityManager } from 'typeorm';

// import type { PaginatedResult } from '@krgeobuk/core/interfaces';
// import type { ListQuery } from '@krgeobuk/user/interfaces';

import { ServiceManager } from '@modules/service/index.js';

import { RoleEntity } from './entities/role.entity.js';
import { RoleRepository } from './role.repositoty.js';

interface RoleFilter {
  name?: string;
  description?: string;
  priority?: number;
  serviceId?: string;
}

@Injectable()
export class RoleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly serviceManager: ServiceManager,
    private readonly roleRepo: RoleRepository
  ) {}

  // async searchRoles(query: SearchQuery): Promise<PaginatedResult<SearchResult>> {
  //   return this.roleRepo.search(query);
  // }

  // async getRoles(query: SearchQuery): Promise<PaginatedResult<SearchResult>> {
  //   return this.roleRepo.search(query);
  // }

  async findById(id: string): Promise<RoleEntity | null> {
    return this.roleRepo.findOneById(id);
  }

  async findByServiceIds(serviceIds: string[]): Promise<RoleEntity[]> {
    return this.roleRepo.find({ where: { serviceId: In(serviceIds) } });
  }

  async findByAnd(filter: RoleFilter = {}): Promise<RoleEntity[]> {
    const where: FindOptionsWhere<RoleEntity> = {};

    if (filter.name) where.name = filter.name;
    if (filter.description) where.description = filter.description;
    if (filter.priority) where.priority = filter.priority;
    if (filter.serviceId) where.serviceId = filter.serviceId;

    // ✅ 필터 없으면 전체 조회
    if (Object.keys(where).length === 0) {
      return this.roleRepo.find(); // 조건 없이 전체 조회
    }

    return this.roleRepo.find({ where });
  }

  async findByOr(filter: RoleFilter = {}): Promise<RoleEntity[]> {
    const { name, description, priority, serviceId } = filter;

    const where: FindOptionsWhere<RoleEntity>[] = [];

    if (name) where.push({ name });
    if (description) where.push({ description });
    if (priority) where.push({ priority });
    if (serviceId) where.push({ serviceId });

    // ✅ 필터 없으면 전체 조회
    if (where.length === 0) {
      return this.roleRepo.find(); // 조건 없이 전체 조회
    }

    return this.roleRepo.find({ where });
  }

  // async getRolesWithService(): Promise<RoleWithServiceDto[]> {
  //   const [roles, services] = await Promise.all([
  //     this.roleRepo.find(), // 역할 목록
  //     this.serviceManager.find(), // 서비스 목록
  //   ]);

  //   const serviceMap = new Map(services.map((s) => [s.id, s]));

  //   return roles.map((role) => ({
  //     id: role.id,
  //     name: role.name,
  //     priority: role.priority,
  //     service: serviceMap.get(role.serviceId),
  //   }));
  // }

  async createRole(
    attrs: Partial<RoleEntity>,
    transactionManager?: EntityManager
  ): Promise<RoleEntity> {
    const roleEntity = new RoleEntity();

    Object.assign(roleEntity, attrs);

    return this.roleRepo.saveEntity(roleEntity, transactionManager);
  }

  async updateRole(
    roleEntity: RoleEntity,
    transactionManager?: EntityManager
  ): Promise<UpdateResult> {
    return this.roleRepo.updateEntity(roleEntity, transactionManager);
  }

  async deleteRole(id: string): Promise<UpdateResult> {
    return this.roleRepo.softDelete(id);
  }
}
