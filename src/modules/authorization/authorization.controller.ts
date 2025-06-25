import { Controller } from '@nestjs/common';
// import { EntityManager } from 'typeorm';
// import { Request } from 'express';
// import { ConfigService } from '@nestjs/config';

import { SwaggerApiTags } from '@krgeobuk/swagger/decorators';
// import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { AuthorizationService } from './authorization.service.js';

// import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
// import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';

@SwaggerApiTags({ tags: ['authorizations'] })
@Controller('authorizations')
// @Serialize({ dto: UserDto })
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  // @Get()
  // getUsers(@Query() query: ListQueryDto): Promise<PaginatedResult<Partial<User>>> {
  //   return this.userService.findUsers(query);
  // }

  // @Get('me')
  // getMyInfo(@Req() req: Request): void {
  //   const { id } = req.jwt!;

  //   this.userService.findUserById(id);
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string): void {
  //   this.userService.findUserById(id);
  // }
}

