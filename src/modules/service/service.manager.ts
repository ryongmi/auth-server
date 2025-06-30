import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, UpdateResult } from 'typeorm';
// import { EntityManager } from 'typeorm';

// import type { PaginatedResult } from '@krgeobuk/core/interfaces';
// import type { ListQuery } from '@krgeobuk/user/interfaces';

import { ServiceEntity } from './entities/service.entity.js';
import { ServiceRepository } from './service.repositoty.js';

@Injectable()
export class ServiceManager {
  constructor(
    private readonly dataSource: DataSource,
    private readonly serviceRepo: ServiceRepository
  ) {}

  // async searchRoles(query: SearchQuery): Promise<PaginatedResult<SearchResult>> {
  //   return this.serviceRepo.search(query);
  // }

  // async getRoles(query: SearchQuery): Promise<PaginatedResult<SearchResult>> {
  //   return this.serviceRepo.search(query);
  // }

  async findServiceById(id: string): Promise<ServiceEntity | null> {
    return this.serviceRepo.findOneById(id);
  }

  async findServicesByServiceName(name: string): Promise<ServiceEntity[] | undefined> {
    return this.serviceRepo.find({ where: { name } });
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
