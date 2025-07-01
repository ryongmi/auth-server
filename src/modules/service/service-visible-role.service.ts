import { Injectable } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, In, UpdateResult } from 'typeorm';

import { ServiceVisibleRoleEntity } from './entities/service-visible-role.entity.js';
import { ServiceVisibleRoleRepository } from './service-visible-role.repositoty.js';

interface Filter {
  serviceId?: string;
  roleId?: string;
}

@Injectable()
export class ServiceVisibleRoleService {
  constructor(
    // private readonly dataSource: DataSource,
    private readonly svrRepo: ServiceVisibleRoleRepository
  ) {}

  async findByServiceId(serviceId: string): Promise<ServiceVisibleRoleEntity[]> {
    return this.svrRepo.find({ where: { serviceId } });
  }

  async findByRoleId(roleId: string): Promise<ServiceVisibleRoleEntity[]> {
    return this.svrRepo.find({ where: { roleId } });
  }

  async findByServiceIds(serviceIds: string[]): Promise<ServiceVisibleRoleEntity[]> {
    return this.svrRepo.find({ where: { serviceId: In(serviceIds) } });
  }

  async findByRoleIds(roleIds: string[]): Promise<ServiceVisibleRoleEntity[]> {
    return this.svrRepo.find({ where: { roleId: In(roleIds) } });
  }

  async findByAnd(filter: Filter = {}): Promise<ServiceVisibleRoleEntity[]> {
    const where: FindOptionsWhere<ServiceVisibleRoleEntity> = {};

    if (filter.serviceId) where.serviceId = filter.serviceId;
    if (filter.roleId) where.roleId = filter.roleId;

    // ✅ 필터 없으면 전체 조회
    if (Object.keys(where).length === 0) {
      return this.svrRepo.find(); // 조건 없이 전체 조회
    }

    return this.svrRepo.find({ where });
  }

  async findByOr(filter: Filter = {}): Promise<ServiceVisibleRoleEntity[]> {
    const { serviceId, roleId } = filter;

    const where: FindOptionsWhere<ServiceVisibleRoleEntity>[] = [];

    if (serviceId) where.push({ serviceId });
    if (roleId) where.push({ roleId });

    // ✅ 필터 없으면 전체 조회
    if (where.length === 0) {
      return this.svrRepo.find(); // 조건 없이 전체 조회
    }

    return this.svrRepo.find({ where });
  }

  async createServiceVisibleRole(
    attrs: Partial<ServiceVisibleRoleEntity>,
    transactionManager?: EntityManager
  ): Promise<ServiceVisibleRoleEntity> {
    const svrEntity = new ServiceVisibleRoleEntity();

    Object.assign(svrEntity, attrs);

    return this.svrRepo.saveEntity(svrEntity, transactionManager);
  }

  async updateServiceVisibleRole(
    svrEntity: ServiceVisibleRoleEntity,
    transactionManager?: EntityManager
  ): Promise<UpdateResult> {
    return this.svrRepo.updateEntity(svrEntity, transactionManager);
  }

  async deleteServiceVisibleRole(id: string): Promise<UpdateResult> {
    return this.svrRepo.softDelete(id);
  }
}
