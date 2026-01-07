import { Controller, Get, Delete, Param, UseGuards, HttpCode } from '@nestjs/common';

import '@krgeobuk/core/interfaces/express';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
  SwaggerApiBearerAuth,
} from '@krgeobuk/swagger/decorators';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';

import { OAuthLinkageService } from './oauth-linkage.service.js';
import { OAuthAccountEntity } from './entities/oauth-account.entity.js';

@SwaggerApiTags({ tags: ['oauth-account'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('oauth/accounts')
export class OAuthAccountController {
  constructor(private readonly oauthLinkageService: OAuthLinkageService) {}

  /**
   * 현재 사용자가 연동한 OAuth 계정 목록 조회
   */
  @Get()
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '연동된 OAuth 계정 목록 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '연동된 OAuth 계정 목록을 성공적으로 조회했습니다.',
  })
  async getLinkedAccounts(
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<OAuthAccountEntity[]> {
    return this.oauthLinkageService.getLinkedAccounts(userId);
  }

  /**
   * OAuth 계정 연동 해제
   */
  @Delete(':provider')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: 'OAuth 계정 연동 해제' })
  @SwaggerApiOkResponse({
    status: 200,
    description: 'OAuth 계정 연동이 성공적으로 해제되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '최소 1개의 로그인 방식은 유지되어야 합니다.',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '연동되지 않은 계정입니다.',
  })
  async unlinkAccount(
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @Param('provider') provider: OAuthAccountProviderType
  ): Promise<{ success: boolean; message: string }> {
    await this.oauthLinkageService.unlinkOAuthAccount(userId, provider);

    return {
      success: true,
      message: `${provider} 계정 연동이 해제되었습니다.`,
    };
  }
}
