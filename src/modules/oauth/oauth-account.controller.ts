import { Controller, Get, Delete, Param, UseGuards, HttpCode } from '@nestjs/common';

import '@krgeobuk/core/interfaces/express';
import { Serialize } from '@krgeobuk/core/decorators';
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
import { OAuthAccountSearchResultDto } from '@krgeobuk/oauth/dtos';
import { OAuthResponse } from '@krgeobuk/oauth/response';
import { OAuthError } from '@krgeobuk/oauth/exception';

import { OAuthLinkageService } from './oauth-linkage.service.js';

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
  @HttpCode(OAuthResponse.LINKED_ACCOUNTS_FETCHED.statusCode)
  @SwaggerApiOperation({ summary: '연동된 OAuth 계정 목록 조회' })
  @SwaggerApiOkResponse({
    status: OAuthResponse.LINKED_ACCOUNTS_FETCHED.statusCode,
    description: OAuthResponse.LINKED_ACCOUNTS_FETCHED.message,
  })
  @Serialize({ dto: OAuthAccountSearchResultDto, ...OAuthResponse.LINKED_ACCOUNTS_FETCHED })
  async getLinkedAccounts(
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<OAuthAccountSearchResultDto[]> {
    return this.oauthLinkageService.getLinkedAccounts(userId);
  }

  /**
   * OAuth 계정 연동 해제
   */
  @Delete(':provider')
  @HttpCode(OAuthResponse.ACCOUNT_UNLINKED.statusCode)
  @SwaggerApiOperation({ summary: 'OAuth 계정 연동 해제' })
  @SwaggerApiOkResponse({
    status: OAuthResponse.ACCOUNT_UNLINKED.statusCode,
    description: OAuthResponse.ACCOUNT_UNLINKED.message,
  })
  @SwaggerApiErrorResponse({
    status: OAuthError.CANNOT_UNLINK_LAST_ACCOUNT.statusCode,
    description: OAuthError.CANNOT_UNLINK_LAST_ACCOUNT.message,
  })
  @SwaggerApiErrorResponse({
    status: OAuthError.PROVIDER_NOT_LINKED.statusCode,
    description: OAuthError.PROVIDER_NOT_LINKED.message,
  })
  @Serialize({ ...OAuthResponse.ACCOUNT_UNLINKED })
  async unlinkAccount(
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @Param('provider') provider: OAuthAccountProviderType
  ): Promise<void> {
    await this.oauthLinkageService.unlinkOAuthAccount(userId, provider);
  }
}
