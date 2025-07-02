import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
// import { Request, Response } from 'express';

import { Serialize } from '@krgeobuk/core/decorators';

// import {
//   SearchQueryDto,
//   ChangePasswordDto,
//   UpdateMyProfileDto,
//   SearchResultDto,
//   DetailDto,
// } from '@krgeobuk/role/dtos';
// import { AuthError } from '@krgeobuk/role/exception';
// import { AuthResponse } from '@krgeobuk/role/response';
import {
  SwaggerApiTags,
  // SwaggerApiBody,
  // SwaggerApiOperation,
  // SwaggerApiOkResponse,
  // SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';
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
  // @HttpCode(UserResponse.USER_SEARCH_SUCCESS.statusCode)
  // @SwaggerApiBearerAuth()
  // @SwaggerApiOperation({ summary: '유저 목록 조회' })
  // @SwaggerApiPaginatedResponse({
  //   status: UserResponse.USER_SEARCH_SUCCESS.statusCode,
  //   description: UserResponse.USER_SEARCH_SUCCESS.message,
  //   dto: SearchResultDto,
  // })
  // @SwaggerApiErrorResponse({
  //   status: UserError.USER_SEARCH_ERROR.statusCode,
  //   description: UserError.USER_SEARCH_ERROR.message,
  // })
  // @UseGuards(AccessTokenGuard)
  // @Serialize({
  //   dto: PaginatedSearchResultDto,
  //   ...UserResponse.USER_SEARCH_SUCCESS,
  // })
  // async searchRoles(@Query() query: SearchQueryDto): Promise<PaginatedSearchResultDto> {
  //   return this.roleService.searchRoles(query);
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
