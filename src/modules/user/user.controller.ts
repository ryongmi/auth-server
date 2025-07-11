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

import { Serialize } from '@krgeobuk/core/decorators';
import {
  UserSearchQueryDto,
  ChangePasswordDto,
  UpdateMyProfileDto,
  UserSearchResultDto,
  UserPaginatedSearchResultDto,
  UserDetailDto,
} from '@krgeobuk/user/dtos';
import { UserResponse } from '@krgeobuk/user/response';
import { UserError } from '@krgeobuk/user/exception';
import { UserIdParamsDto } from '@krgeobuk/shared/user/dtos';
import {
  SwaggerApiTags,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiBody,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
  SwaggerApiPaginatedResponse,
} from '@krgeobuk/swagger/decorators';
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';

import { UserService } from './user.service.js';

@SwaggerApiTags({ tags: ['users'] })
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @HttpCode(UserResponse.USER_SEARCH_SUCCESS.statusCode)
  @SwaggerApiBearerAuth()
  @SwaggerApiOperation({ summary: '유저 목록 조회' })
  @SwaggerApiPaginatedResponse({
    status: UserResponse.USER_SEARCH_SUCCESS.statusCode,
    description: UserResponse.USER_SEARCH_SUCCESS.message,
    dto: UserSearchResultDto,
  })
  @SwaggerApiErrorResponse({
    status: UserError.USER_SEARCH_ERROR.statusCode,
    description: UserError.USER_SEARCH_ERROR.message,
  })
  @UseGuards(AccessTokenGuard)
  @Serialize({
    dto: UserPaginatedSearchResultDto,
    ...UserResponse.USER_SEARCH_SUCCESS,
  })
  async searchUsers(@Query() query: UserSearchQueryDto): Promise<UserPaginatedSearchResultDto> {
    return this.userService.searchUsers(query);
  }

  @Get('me')
  @HttpCode(UserResponse.PROFILE_FETCH_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '본인 프로필 조회' })
  @SwaggerApiOkResponse({
    status: UserResponse.PROFILE_FETCH_SUCCESS.statusCode,
    description: UserResponse.PROFILE_FETCH_SUCCESS.message,
    dto: UserDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: UserError.PROFILE_FETCH_ERROR.statusCode,
    description: UserError.PROFILE_FETCH_ERROR.message,
  })
  @UseGuards(AccessTokenGuard)
  @Serialize({
    dto: UserDetailDto,
    ...UserResponse.PROFILE_FETCH_SUCCESS,
  })
  async getMyProfile(@CurrentJwt() { id }: JwtPayload): Promise<UserDetailDto> {
    return await this.userService.getMyProfile(id);
  }

  // 권한 도입하면 체크하는 가드? 하나 넣어야할듯
  @Patch('me')
  @HttpCode(UserResponse.PROFILE_UPDATE_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '본인 프로필 수정' })
  @SwaggerApiOkResponse({
    status: UserResponse.PROFILE_UPDATE_SUCCESS.statusCode,
    description: UserResponse.PROFILE_UPDATE_SUCCESS.message,
  })
  @SwaggerApiErrorResponse({
    status: UserError.PROFILE_UPDATE_ERROR.statusCode,
    description: UserError.PROFILE_UPDATE_ERROR.message,
  })
  @SwaggerApiErrorResponse({
    status: UserError.USER_NOT_FOUND.statusCode,
    description: UserError.USER_NOT_FOUND.message,
  })
  @UseGuards(AccessTokenGuard)
  @Serialize({
    ...UserResponse.PROFILE_UPDATE_SUCCESS,
  })
  async updateMyProfile(
    @CurrentJwt() { id }: JwtPayload,
    @Body() body: UpdateMyProfileDto
  ): Promise<void> {
    return await this.userService.updateMyProfile(id, body);
  }

  // 권한 도입하면 체크하는 가드? 하나 넣어야할듯
  @Patch('password')
  @HttpCode(UserResponse.PASSWORD_CHANGE_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '본인 비밀번호 수정' })
  @SwaggerApiBody({
    dto: ChangePasswordDto,
    description: '비밀번호 수정에 필요한 데이터',
  })
  @SwaggerApiOkResponse({
    status: UserResponse.PASSWORD_CHANGE_SUCCESS.statusCode,
    description: UserResponse.PASSWORD_CHANGE_SUCCESS.message,
  })
  @SwaggerApiErrorResponse({
    status: UserError.PASSWORD_CHANGE_ERROR.statusCode,
    description: UserError.PASSWORD_CHANGE_ERROR.message,
  })
  @SwaggerApiErrorResponse({
    status: UserError.USER_NOT_FOUND.statusCode,
    description: UserError.USER_NOT_FOUND.message,
  })
  @SwaggerApiErrorResponse({
    status: UserError.PASSWORD_INCORRECT.statusCode,
    description: UserError.PASSWORD_INCORRECT.message,
  })
  @UseGuards(AccessTokenGuard)
  @Serialize({
    ...UserResponse.PASSWORD_CHANGE_SUCCESS,
  })
  async changePassword(
    @CurrentJwt() { id }: JwtPayload,
    @Body() body: ChangePasswordDto
  ): Promise<void> {
    return await this.userService.changePassword(id, body);
  }

  @Delete('me')
  @HttpCode(UserResponse.ACCOUNT_DELETE_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '본인 프로필 삭제' })
  @SwaggerApiOkResponse({
    status: UserResponse.ACCOUNT_DELETE_SUCCESS.statusCode,
    description: UserResponse.ACCOUNT_DELETE_SUCCESS.message,
  })
  @SwaggerApiErrorResponse({
    status: UserError.ACCOUNT_DELETE_ERROR.statusCode,
    description: UserError.ACCOUNT_DELETE_ERROR.message,
  })
  @UseGuards(AccessTokenGuard)
  @Serialize({
    ...UserResponse.ACCOUNT_DELETE_SUCCESS,
  })
  async deleteMyAccount(@CurrentJwt() { id }: JwtPayload): Promise<void> {
    return await this.userService.deleteMyAccount(id);
  }

  @Get(':userId')
  @HttpCode(UserResponse.USER_FETCH_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '유저 정보 조회' })
  @SwaggerApiParam({
    name: 'userId',
    type: String,
    description: '유저 ID',
    required: true,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @SwaggerApiOkResponse({
    status: UserResponse.USER_FETCH_SUCCESS.statusCode,
    description: UserResponse.USER_FETCH_SUCCESS.message,
    dto: UserDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: UserError.USER_FETCH_ERROR.statusCode,
    description: UserError.USER_FETCH_ERROR.message,
  })
  @UseGuards(AccessTokenGuard)
  @Serialize({
    dto: UserDetailDto,
    ...UserResponse.USER_FETCH_SUCCESS,
  })
  async getUserById(@Param() params: UserIdParamsDto): Promise<UserDetailDto> {
    return await this.userService.getUserProfile(params.userId);
  }
}

