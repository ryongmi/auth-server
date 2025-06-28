import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Role } from './entities/role.entity.js';
import { UserRole } from './entities/user-role.entity.js';

import { RoleRepository } from './role.repositoty.js';
import { UserRoleRepository } from './user-role.repositoty.js';

import { RoleController } from './role.controller.js';
import { RoleService } from './role.service.js';
import { UserRoleController } from './user-role.controller.js';
import { UserRoleService } from './user-role.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Role, UserRole])],
  controllers: [RoleController, UserRoleController],
  providers: [RoleService, UserRoleService, UserRoleRepository, RoleRepository],
  exports: [RoleService, UserRoleService], // 다른 모듈에서 서비스를 사용할 수 있도록 exports에 추가
})
export class RoleModule {}
