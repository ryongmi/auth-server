import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Role } from './entities/role.entity.js';
import { ServiceVisibleRole } from './entities/service-visible-role.entity.js';
import { Service } from './entities/service.entity.js';
import { UserRole } from './entities/user-role.entity.js';

import { RoleRepository } from './role.repositoty.js';
import { ServiceVisibleRoleRepository } from './service-visible-role.repositoty.js';
import { ServiceRepository } from './service.repositoty.js';
import { UserRoleRepository } from './user-role.repositoty.js';

import { AuthorizationController } from './authorization.controller.js';
import { AuthorizationService } from './authorization.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Service, Role, UserRole, ServiceVisibleRole])],
  controllers: [AuthorizationController],
  providers: [
    AuthorizationService,
    UserRoleRepository,
    RoleRepository,
    ServiceRepository,
    ServiceVisibleRoleRepository,
  ],
  exports: [AuthorizationService], // 다른 모듈에서 User 서비스를 사용할 수 있도록 exports에 추가
})
export class AuthorizationModule {}
