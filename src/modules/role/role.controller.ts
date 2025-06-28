import { Controller } from '@nestjs/common';
// import { EntityManager } from 'typeorm';
// import { Request } from 'express';
// import { ConfigService } from '@nestjs/config';

import { SwaggerApiTags } from '@krgeobuk/swagger/decorators';
// import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { RoleService } from './role.service.js';

// import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
// import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';

@SwaggerApiTags({ tags: ['roles'] })
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  // 전체 Role 목록
  // @Get()
  // findAll() {
  //   return this.roleService.findAll();
  // }

  // // Role 생성
  // @Post()
  // create(@Body() dto: CreateRoleDto) {
  //   return this.roleService.create(dto);
  // }

  // // 특정 Role 조회
  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.roleService.findOne(id);
  // }

  // // 특정 Role 삭제
  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.roleService.remove(id);
  // }
}

