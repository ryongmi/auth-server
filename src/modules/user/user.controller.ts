import { Controller, Get, Param, Query, Req } from "@nestjs/common";
// import { EntityManager } from 'typeorm';
import { Request } from "express";
// import { ConfigService } from '@nestjs/config';
import { UserQueryDto } from "./dtos";
import {
  // Serialize,
  // TransactionManager,
  SwaagerApiTags,
  // SwaagerApiBody,
  // SwaagerApiOperation,
  // SwaagerApiQuery,
  // SwaagerApiOkResponse,
  // SwaagerApiErrorResponse,
} from "../../common/decorators";
import { UserService } from "./user.service";

@SwaagerApiTags({ tags: ["users"] })
@Controller("users")
// @Serialize({ dto: UserDto })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getUsers(@Query() query: UserQueryDto) {
    return this.userService.findUsers(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.userService.findUserById(id);
  }

  @Get("me")
  getMyInfo(@Req() req: Request) {
    return this.userService.findUserById(req.user.id);
  }
}
