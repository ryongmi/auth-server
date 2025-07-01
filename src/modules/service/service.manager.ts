import { Injectable } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, UpdateResult } from 'typeorm';
// import { EntityManager } from 'typeorm';

// import type { PaginatedResult } from '@krgeobuk/core/interfaces';
// import type { ListQuery } from '@krgeobuk/user/interfaces';

import { ServiceEntity } from './entities/service.entity.js';
import { ServiceRepository } from './service.repositoty.js';

interface Filter {
  name?: string;
  description?: string; // 홈페이지 가입 이메일, 통합 기준
  url?: string; // 실제 서비스 URL
  isVisible?: boolean; // 포털에서 표시 여부
  isVisibleByRole?: boolean; // 권한 기반 표시 여부
  displayName?: string; // 사용자에게 보여줄 이름 (예: "관리자 포털")
  iconUrl?: string; // UI에 표시할 서비스 아이콘
}

@Injectable()
export class ServiceManager {
  constructor(
    // private readonly dataSource: DataSource,
    private readonly serviceRepo: ServiceRepository
  ) {}

  // async searchRoles(query: SearchQuery): Promise<PaginatedResult<SearchResult>> {
  //   return this.serviceRepo.search(query);
  // }

  // async getRoles(query: SearchQuery): Promise<PaginatedResult<SearchResult>> {
  //   return this.serviceRepo.search(query);
  // }
  async findById(id: string): Promise<ServiceEntity | null> {
    return this.serviceRepo.findOneById(id);
  }

  async findByAnd(filter: Filter = {}): Promise<ServiceEntity[]> {
    const where: FindOptionsWhere<ServiceEntity> = {};

    if (filter.name) where.name = filter.name;
    if (filter.description) where.description = filter.description;
    if (filter.url) where.url = filter.url;
    if (filter.isVisible) where.isVisible = filter.isVisible;
    if (filter.isVisibleByRole) where.isVisibleByRole = filter.isVisibleByRole;
    if (filter.displayName) where.displayName = filter.displayName;
    if (filter.iconUrl) where.iconUrl = filter.iconUrl;

    // ✅ 필터 없으면 전체 조회
    if (Object.keys(where).length === 0) {
      return this.serviceRepo.find(); // 조건 없이 전체 조회
    }

    return this.serviceRepo.find({ where });
  }

  async findByOr(filter: Filter = {}): Promise<ServiceEntity[]> {
    const { name, description, url, isVisible, isVisibleByRole, displayName, iconUrl } = filter;

    const where: FindOptionsWhere<ServiceEntity>[] = [];

    if (name) where.push({ name });
    if (description) where.push({ description });
    if (url) where.push({ url });
    if (isVisible) where.push({ isVisible });
    if (isVisibleByRole) where.push({ isVisibleByRole });
    if (displayName) where.push({ displayName });
    if (iconUrl) where.push({ iconUrl });

    // ✅ 필터 없으면 전체 조회
    if (where.length === 0) {
      return this.serviceRepo.find(); // 조건 없이 전체 조회
    }

    return this.serviceRepo.find({ where });
  }

  async createService(
    attrs: Partial<ServiceEntity>,
    transactionManager?: EntityManager
  ): Promise<ServiceEntity> {
    const serviceEntity = new ServiceEntity();

    Object.assign(serviceEntity, attrs);

    return this.serviceRepo.saveEntity(serviceEntity, transactionManager);
  }

  async updateService(
    serviceEntity: ServiceEntity,
    transactionManager?: EntityManager
  ): Promise<UpdateResult> {
    return this.serviceRepo.updateEntity(serviceEntity, transactionManager);
  }

  async deleteService(id: string): Promise<UpdateResult> {
    return this.serviceRepo.softDelete(id);
  }
}
