import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServiceVisibleRole } from './entities/service-visible-role.entity.js';
import { Service } from './entities/service.entity.js';

import { ServiceVisibleRoleRepository } from './service-visible-role.repositoty.js';
import { ServiceRepository } from './service.repositoty.js';

import { ServiceController } from './service.controller.js';
import { ServiceService } from './service.service.js';
import { ServiceVisibleRoleController } from './service-visible-role.controller.js';
import { ServiceVisibleRoleService } from './service-visible-role.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Service, ServiceVisibleRole])],
  controllers: [ServiceController, ServiceVisibleRoleController],
  providers: [
    ServiceService,
    ServiceVisibleRoleService,
    ServiceRepository,
    ServiceVisibleRoleRepository,
  ],
  exports: [ServiceService, ServiceVisibleRoleService], // 다른 모듈에서 서비스를 사용할 수 있도록 exports에 추가
})
export class ServiceModule {}
