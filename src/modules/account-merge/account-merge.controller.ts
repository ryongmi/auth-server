import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';

import { Serialize } from '@krgeobuk/core/decorators';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
  SwaggerApiBearerAuth,
  SwaggerApiQuery,
} from '@krgeobuk/swagger/decorators';
import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import {
  InitiateAccountMergeRequestDto,
  InitiateAccountMergeResponseDto,
  GetAccountMergeResponseDto,
} from '@krgeobuk/account-merge/dtos';
import { AccountMergeResponse } from '@krgeobuk/account-merge/response';
import { AccountMergeError } from '@krgeobuk/account-merge/exception';

import { RefreshTokenGuard } from '@common/jwt/guards/index.js';
import { MERGE_REQUEST_EXPIRATION_MS } from '@common/constants/index.js';
import { UserService } from '@modules/user/user.service.js';

import { AccountMergeService } from './account-merge.service.js';

@SwaggerApiTags({ tags: ['account-merge'] })
@Controller('account-merge')
export class AccountMergeController {
  constructor(
    private readonly accountMergeService: AccountMergeService,
    private readonly userService: UserService
  ) {}

  /**
   * 토큰 검증 및 requestId 조회
   * 이메일 링크에서 token을 검증하고 requestId를 반환
   */
  @Get('verify-token')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '병합 확인 토큰 검증' })
  @SwaggerApiQuery({ name: 'token', required: true, description: '병합 확인 토큰 (UUID)' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '토큰 검증 성공, requestId 반환',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '토큰이 유효하지 않거나 만료되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '병합 요청을 찾을 수 없습니다.',
  })
  async verifyToken(@Query('token') token: string): Promise<{ requestId: number }> {
    const requestId = await this.accountMergeService.verifyToken(token);
    return { requestId };
  }

  /**
   * 계정 병합 요청 시작
   * User A가 이미 가입된 이메일로 다른 OAuth provider로 로그인 시도 시
   */
  @Post('request')
  @HttpCode(AccountMergeResponse.REQUEST_CREATED.statusCode)
  @SwaggerApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @SwaggerApiOperation({ summary: '계정 병합 요청 시작' })
  @SwaggerApiOkResponse({
    status: AccountMergeResponse.REQUEST_CREATED.statusCode,
    description: AccountMergeResponse.REQUEST_CREATED.message,
  })
  @SwaggerApiErrorResponse({
    status: AccountMergeError.SAME_ACCOUNT_MERGE.statusCode,
    description: AccountMergeError.SAME_ACCOUNT_MERGE.message,
  })
  @SwaggerApiErrorResponse({
    status: AccountMergeError.REQUEST_NOT_FOUND.statusCode,
    description: AccountMergeError.REQUEST_NOT_FOUND.message,
  })
  @Serialize({ dto: InitiateAccountMergeResponseDto, ...AccountMergeResponse.REQUEST_CREATED })
  async initiateAccountMerge(
    @Body() dto: InitiateAccountMergeRequestDto,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<InitiateAccountMergeResponseDto> {
    const requestId = await this.accountMergeService.initiateAccountMerge(
      dto.provider,
      dto.providerId,
      dto.email,
      userId
    );

    return { requestId };
  }

  /**
   * 계정 병합 요청 조회
   */
  @Get(':requestId')
  @HttpCode(AccountMergeResponse.FETCH_SUCCESS.statusCode)
  @SwaggerApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @SwaggerApiOperation({ summary: '계정 병합 요청 조회' })
  @SwaggerApiOkResponse({
    status: AccountMergeResponse.FETCH_SUCCESS.statusCode,
    description: AccountMergeResponse.FETCH_SUCCESS.message,
  })
  @SwaggerApiErrorResponse({
    status: AccountMergeError.REQUEST_NOT_FOUND.statusCode,
    description: AccountMergeError.REQUEST_NOT_FOUND.message,
  })
  @Serialize({ dto: GetAccountMergeResponseDto, ...AccountMergeResponse.FETCH_SUCCESS })
  async getAccountMerge(
    @Param('requestId', ParseIntPipe) requestId: number
  ): Promise<GetAccountMergeResponseDto> {
    const request = await this.accountMergeService.getAccountMerge(requestId);

    // User 정보 조회 (이메일 표시용)
    const sourceUser = await this.userService.findById(request.sourceUserId);
    const targetUser = await this.userService.findById(request.targetUserId);

    // 만료 시간 계산
    const expiresAt = new Date(request.createdAt.getTime() + MERGE_REQUEST_EXPIRATION_MS);

    return {
      id: request.id,
      createdAt: request.createdAt,
      expiresAt,
      provider: request.provider,
      status: request.status,
      sourceEmail: sourceUser?.email || '',
      targetEmail: targetUser?.email || '',
    };
  }

  /**
   * 계정 병합 확인 (User B가 승인)
   */
  @Post(':requestId/confirm')
  @HttpCode(AccountMergeResponse.MERGE_COMPLETED.statusCode)
  @SwaggerApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @SwaggerApiOperation({ summary: '계정 병합 확인 (User B가 승인)' })
  @SwaggerApiOkResponse({
    status: AccountMergeResponse.MERGE_COMPLETED.statusCode,
    description: AccountMergeResponse.MERGE_COMPLETED.message,
  })
  @SwaggerApiErrorResponse({
    status: AccountMergeError.INVALID_STATUS.statusCode,
    description: AccountMergeError.INVALID_STATUS.message,
  })
  @SwaggerApiErrorResponse({
    status: AccountMergeError.UNAUTHORIZED.statusCode,
    description: AccountMergeError.UNAUTHORIZED.message,
  })
  @SwaggerApiErrorResponse({
    status: AccountMergeError.REQUEST_NOT_FOUND.statusCode,
    description: AccountMergeError.REQUEST_NOT_FOUND.message,
  })
  @SwaggerApiErrorResponse({
    status: AccountMergeError.EXECUTION_FAILED.statusCode,
    description: AccountMergeError.EXECUTION_FAILED.message,
  })
  @Serialize({ ...AccountMergeResponse.MERGE_COMPLETED })
  async confirmAccountMerge(
    @Param('requestId', ParseIntPipe) requestId: number,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<void> {
    await this.accountMergeService.confirmAccountMerge(requestId, userId);
  }

  /**
   * 계정 병합 거부 (User B가 거부)
   */
  @Post(':requestId/reject')
  @HttpCode(AccountMergeResponse.MERGE_REJECTED.statusCode)
  @SwaggerApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @SwaggerApiOperation({ summary: '계정 병합 거부 (User B가 거부)' })
  @SwaggerApiOkResponse({
    status: AccountMergeResponse.MERGE_REJECTED.statusCode,
    description: AccountMergeResponse.MERGE_REJECTED.message,
  })
  @SwaggerApiErrorResponse({
    status: AccountMergeError.INVALID_STATUS.statusCode,
    description: AccountMergeError.INVALID_STATUS.message,
  })
  @SwaggerApiErrorResponse({
    status: AccountMergeError.UNAUTHORIZED.statusCode,
    description: AccountMergeError.UNAUTHORIZED.message,
  })
  @SwaggerApiErrorResponse({
    status: AccountMergeError.REQUEST_NOT_FOUND.statusCode,
    description: AccountMergeError.REQUEST_NOT_FOUND.message,
  })
  @Serialize({ ...AccountMergeResponse.MERGE_REJECTED })
  async rejectAccountMerge(
    @Param('requestId', ParseIntPipe) requestId: number,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<void> {
    await this.accountMergeService.rejectAccountMerge(requestId, userId);
  }
}
