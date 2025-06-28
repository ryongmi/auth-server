import { Controller } from '@nestjs/common';
// import { EntityManager } from 'typeorm';
// import { Request } from 'express';
// import { ConfigService } from '@nestjs/config';

import { SwaggerApiTags } from '@krgeobuk/swagger/decorators';
// import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { ServiceVisibleRoleService } from './service-visible-role.service.js';

// import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
// import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';

@SwaggerApiTags({ tags: ['services/:serviceId/visible-roles'] })
@Controller('services/:serviceId/visible-roles')
export class ServiceVisibleRoleController {
  constructor(private readonly svrService: ServiceVisibleRoleService) {}

  // 해당 서비스에 접근 가능한 Role 목록 조회
  // @Get()
  // findVisibleRoles(@Param('serviceId') serviceId: string) {
  //   return this.svrService.findRolesByService(serviceId);
  // }

  // // Role 접근 권한 추가
  // @Post()
  // addRole(@Param('serviceId') serviceId: string, @Body() dto: { roleId: string }) {
  //   return this.svrService.addRoleToService(serviceId, dto.roleId);
  // }

  // // Role 접근 권한 제거
  // @Delete(':roleId')
  // removeRole(@Param('serviceId') serviceId: string, @Param('roleId') roleId: string) {
  //   return this.svrService.removeRoleFromService(serviceId, roleId);
  // }
}

