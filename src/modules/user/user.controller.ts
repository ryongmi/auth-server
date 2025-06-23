import { Controller, Get, Param, Query, Req } from '@nestjs/common';
// import { EntityManager } from 'typeorm';
import { Request } from 'express';
// import { ConfigService } from '@nestjs/config';
import { ListQueryDto } from '@krgeobuk/user/dtos';
import { SwaggerApiTags } from '@krgeobuk/swagger/decorators';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { User } from './entities/user.entity.js';
import { UserService } from './user.service.js';

// import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
// import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';

@SwaggerApiTags({ tags: ['users'] })
@Controller('users')
// @Serialize({ dto: UserDto })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getUsers(@Query() query: ListQueryDto): Promise<PaginatedResult<Partial<User>>> {
    return this.userService.findUsers(query);
  }

  @Get('me')
  getMyInfo(@Req() req: Request): void {
    console.log('들어왔누');
    // const { id } = req.jwt!;

    // this.userService.findUserById(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string): void {
    this.userService.findUserById(id);
  }
}

