import { Controller } from '@nestjs/common';
// import { EntityManager } from 'typeorm';
// import { Request } from 'express';
// import { ConfigService } from '@nestjs/config';

import { SwaggerApiTags } from '@krgeobuk/swagger/decorators';
// import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { UserRoleService } from './user-role.service.js';

// import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
// import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';

@SwaggerApiTags({ tags: ['users/:userId/roles'] })
@Controller('users/:userId/roles')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  // 유저의 역할 조회
  // @Get()
  // findUserRoles(@Param('userId') userId: string) {
  //   return this.userRoleService.findRolesByUser(userId);
  // }

  // // 유저에게 역할 부여
  // @Post()
  // assignRoleToUser(@Param('userId') userId: string, @Body() dto: AssignRoleDto) {
  //   return this.userRoleService.assign(userId, dto.roleId);
  // }

  // // 유저의 역할 제거
  // @Delete(':roleId')
  // removeRoleFromUser(@Param('userId') userId: string, @Param('roleId') roleId: string) {
  //   return this.userRoleService.remove(userId, roleId);
  // }
}

