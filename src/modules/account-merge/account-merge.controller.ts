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
import { InitiateAccountMergeDto, AccountMergeResponseDto } from '@krgeobuk/account-merge/dtos';

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
  @HttpCode(201)
  @SwaggerApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @SwaggerApiOperation({ summary: '계정 병합 요청 시작' })
  @SwaggerApiOkResponse({
    status: 201,
    description: '계정 병합 요청이 생성되었습니다. User B에게 확인 이메일이 발송됩니다.',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '잘못된 요청 (동일 계정, OAuth 계정 이미 연동됨 등)',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '사용자를 찾을 수 없습니다.',
  })
  async initiateAccountMerge(
    @Body() dto: InitiateAccountMergeDto,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<{ requestId: number; message: string }> {
    const requestId = await this.accountMergeService.initiateAccountMerge(
      dto.provider,
      dto.providerId,
      dto.email,
      userId
    );

    return {
      requestId,
      message: '계정 병합 요청이 생성되었습니다.',
    };
  }

  /**
   * 계정 병합 요청 조회
   */
  @Get(':requestId')
  @HttpCode(200)
  @SwaggerApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @SwaggerApiOperation({ summary: '계정 병합 요청 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '병합 요청 정보',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '병합 요청을 찾을 수 없습니다.',
  })
  async getAccountMerge(
    @Param('requestId', ParseIntPipe) requestId: number
  ): Promise<AccountMergeResponseDto> {
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
  @HttpCode(200)
  @SwaggerApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @SwaggerApiOperation({ summary: '계정 병합 확인 (User B가 승인)' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '계정 병합이 완료되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '잘못된 요청 (이미 처리됨, 만료됨 등)',
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '권한이 없습니다 (User B만 승인 가능)',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '병합 요청을 찾을 수 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '계정 병합 실패 (Saga 오류)',
  })
  async confirmAccountMerge(
    @Param('requestId', ParseIntPipe) requestId: number,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<{ message: string }> {
    await this.accountMergeService.confirmAccountMerge(requestId, userId);

    return {
      message: '계정 병합이 완료되었습니다.',
    };
  }

  /**
   * 계정 병합 거부 (User B가 거부)
   */
  @Post(':requestId/reject')
  @HttpCode(200)
  @SwaggerApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @SwaggerApiOperation({ summary: '계정 병합 거부 (User B가 거부)' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '계정 병합 요청이 거부되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '잘못된 요청 (이미 처리됨 등)',
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '권한이 없습니다 (User B만 거부 가능)',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '병합 요청을 찾을 수 없습니다.',
  })
  async rejectAccountMerge(
    @Param('requestId', ParseIntPipe) requestId: number,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<{ message: string }> {
    await this.accountMergeService.rejectAccountMerge(requestId, userId);

    return {
      message: '계정 병합 요청이 거부되었습니다.',
    };
  }
}
