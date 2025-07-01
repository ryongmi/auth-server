import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServiceVisibleRoleEntity } from './entities/service-visible-role.entity.js';
import { ServiceEntity } from './entities/service.entity.js';

import { ServiceVisibleRoleRepository } from './service-visible-role.repositoty.js';
import { ServiceRepository } from './service.repositoty.js';

import { ServiceController } from './service.controller.js';
import { ServiceManager } from './service.manager.js';
import { ServiceVisibleRoleController } from './service-visible-role.controller.js';
import { ServiceVisibleRoleService } from './service-visible-role.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceEntity, ServiceVisibleRoleEntity])],
  controllers: [ServiceController, ServiceVisibleRoleController],
  providers: [
    ServiceManager,
    ServiceVisibleRoleService,
    ServiceRepository,
    ServiceVisibleRoleRepository,
  ],
  exports: [ServiceManager, ServiceVisibleRoleService], // 다른 모듈에서 서비스를 사용할 수 있도록 exports에 추가
})
export class ServiceModule {}
