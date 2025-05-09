import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Serialize, TransactionManager } from '../../common/decorators';
import { UserDto, UserQueryDto } from './dtos';
import {
  SwaagerApiTags,
  SwaagerApiBody,
  SwaagerApiOperation,
  SwaagerApiQuery,
  SwaagerApiOkResponse,
  SwaagerApiErrorResponse,
} from '../../common/decorators';
import { UserService } from './user.service';

@SwaagerApiTags({ tags: ['users'] })
@Controller('users')
@Serialize({ dto: UserDto })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll(@Query() query: UserQueryDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Get('me')
  getMyInfo(@Req() req: Request) {
    return this.userService.findOne(req.user.id);
  }
}
