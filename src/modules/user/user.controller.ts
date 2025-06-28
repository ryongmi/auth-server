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
  SearchQueryDto,
  ChangePasswordDto,
  UpdateMyProfileDto,
  SearchResultDto,
  PaginatedSearchResultDto,
  DetailDto,
} from '@krgeobuk/user/dtos';
import { UserResponse } from '@krgeobuk/user/response';
import { UserError } from '@krgeobuk/user/exception';
import {
  SwaggerApiTags,
  SwaggerApiQuery,
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

  @Get('me')
  @HttpCode(UserResponse.PROFILE_FETCH_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '본인 프로필 조회' })
  @SwaggerApiOkResponse({
    status: UserResponse.PROFILE_FETCH_SUCCESS.statusCode,
    description: UserResponse.PROFILE_FETCH_SUCCESS.message,
    dto: DetailDto,
  })
  @SwaggerApiErrorResponse({
    status: UserError.PROFILE_FETCH_ERROR.statusCode,
    description: UserError.PROFILE_FETCH_ERROR.message,
  })
  @UseGuards(AccessTokenGuard)
  @Serialize({
    dto: DetailDto,
    // message: '프로필 조회 성공',
    ...UserResponse.PROFILE_FETCH_SUCCESS,
  })
  async getMyProfile(@CurrentJwt() { id }: JwtPayload): Promise<DetailDto> {
    return await this.userService.getMyProfile(id);
  }

  // 권한 도입하면 체크하는 가드? 하나 넣어야할듯
  @Patch('me')
  @HttpCode(UserResponse.PROFILE_UPDATE_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '본인 프로필 수정' })
  @SwaggerApiBody({
    dto: UpdateMyProfileDto,
    description: '프로필 수정에 필요한 데이터',
  })
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
    // message: '프로필 수정 성공',
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
    // message: '패스워드 수정 성공',
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
    // message: '프로필 삭제 성공',
    ...UserResponse.ACCOUNT_DELETE_SUCCESS,
  })
  async deleteMyAccount(@CurrentJwt() { id }: JwtPayload): Promise<void> {
    return await this.userService.deleteMyAccount(id);
  }

  @Get(':id')
  @HttpCode(UserResponse.USER_FETCH_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '유저 정보 조회' })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '유저 ID',
    required: true,
    example: '123',
  })
  @SwaggerApiOkResponse({
    status: UserResponse.USER_FETCH_SUCCESS.statusCode,
    description: UserResponse.USER_FETCH_SUCCESS.message,
  })
  @SwaggerApiErrorResponse({
    status: UserError.USER_FETCH_ERROR.statusCode,
    description: UserError.USER_FETCH_ERROR.message,
  })
  @UseGuards(AccessTokenGuard)
  @Serialize({
    // message: '프로필 삭제 성공',
    ...UserResponse.USER_FETCH_SUCCESS,
  })
  async getUserById(@Param('id') id: string): Promise<DetailDto> {
    return await this.userService.getUserProfile(id);
  }

  @Get()
  @HttpCode(UserResponse.USER_SEARCH_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '유저 목록 조회' })
  @SwaggerApiQuery({
    name: '유저 목록 조회 필터',
    type: SearchQueryDto,
    description: '유저 목록 조회 필터',
    required: false,
  })
  @SwaggerApiPaginatedResponse({
    status: UserResponse.USER_SEARCH_SUCCESS.statusCode,
    description: UserResponse.USER_SEARCH_SUCCESS.message,
    dto: SearchResultDto,
    // extraModels: [SearchResultDto],
  })
  @SwaggerApiErrorResponse({
    status: UserError.USER_SEARCH_ERROR.statusCode,
    description: UserError.USER_SEARCH_ERROR.message,
  })
  @UseGuards(AccessTokenGuard)
  @Serialize({
    // message: '프로필 삭제 성공',
    dto: PaginatedSearchResultDto,
    ...UserResponse.USER_SEARCH_SUCCESS,
  })
  async searchUsers(@Query() query: SearchQueryDto): Promise<PaginatedSearchResultDto> {
    return this.userService.searchUsers(query);
  }
}
