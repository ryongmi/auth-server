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
  UserProfileDto,
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
import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AccessTokenGuard, OptionalAccessTokenGuard } from '@krgeobuk/jwt/guards';
import { RequireRole } from '@krgeobuk/authorization/decorators';
import { GLOBAL_ROLES } from '@krgeobuk/core/constants';

import { UserService } from './user.service.js';

@SwaggerApiTags({ tags: ['users'] })
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @HttpCode(UserResponse.USER_SEARCH_SUCCESS.statusCode)
  @SwaggerApiBearerAuth()
  @SwaggerApiOperation({ summary: '유저 목록 조회', description: '유저를 검색합니다.' })
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
  @RequireRole(GLOBAL_ROLES.SUPER_ADMIN)
  @Serialize({
    dto: UserPaginatedSearchResultDto,
    ...UserResponse.USER_SEARCH_SUCCESS,
  })
  async searchUsers(@Query() query: UserSearchQueryDto): Promise<UserPaginatedSearchResultDto> {
    return this.userService.searchUsers(query);
  }

  @Get('me')
  @HttpCode(UserResponse.PROFILE_FETCH_SUCCESS.statusCode)
  @SwaggerApiOperation({
    summary: '내 프로필 조회',
    description:
      '로그인된 사용자는 전체 정보를, 비로그인 사용자는 기본 정보를 조회합니다. 토큰은 선택사항입니다.',
  })
  @SwaggerApiOkResponse({
    status: UserResponse.PROFILE_FETCH_SUCCESS.statusCode,
    description: UserResponse.PROFILE_FETCH_SUCCESS.message,
    dto: UserProfileDto,
  })
  @SwaggerApiErrorResponse({
    status: UserError.PROFILE_FETCH_ERROR.statusCode,
    description: UserError.PROFILE_FETCH_ERROR.message,
  })
  @UseGuards(OptionalAccessTokenGuard)
  @Serialize({
    dto: UserProfileDto,
    ...UserResponse.PROFILE_FETCH_SUCCESS,
  })
  async getMyProfile(@CurrentJwt() { userId }: AuthenticatedJwt): Promise<UserProfileDto> {
    return await this.userService.getMyProfile(userId);
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
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @Body() body: UpdateMyProfileDto
  ): Promise<void> {
    return await this.userService.updateMyProfile(userId, body);
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
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @Body() body: ChangePasswordDto
  ): Promise<void> {
    return await this.userService.changePassword(userId, body);
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
  async deleteMyAccount(@CurrentJwt() { userId }: AuthenticatedJwt): Promise<void> {
    return await this.userService.deleteMyAccount(userId);
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
  @RequireRole(GLOBAL_ROLES.SUPER_ADMIN)
  @Serialize({
    dto: UserDetailDto,
    ...UserResponse.USER_FETCH_SUCCESS,
  })
  async getUserById(@Param() params: UserIdParamsDto): Promise<UserDetailDto> {
    return await this.userService.getUserProfile(params.userId);
  }
}
