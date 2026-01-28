import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { OAuthTcpPatterns } from '@krgeobuk/oauth/tcp/patterns';
import type { TcpYouTubeTokenParams, TcpYouTubeTokenResult } from '@krgeobuk/oauth/tcp/interfaces';

import { OAuthTokenService } from './oauth-token.service.js';

@Controller()
export class OAuthTokenTcpController {
  private readonly logger = new Logger(OAuthTokenTcpController.name);

  constructor(private readonly oauthTokenService: OAuthTokenService) {}

  /**
   * YouTube 액세스 토큰 조회 (TCP)
   * 토큰이 만료 임박 시 자동 갱신
   */
  @MessagePattern(OAuthTcpPatterns.YOUTUBE_GET_ACCESS_TOKEN)
  async getYouTubeAccessToken(
    @Payload() data: TcpYouTubeTokenParams
  ): Promise<TcpYouTubeTokenResult> {
    this.logger.log(`TCP: Getting YouTube access token - userId: ${data.userId}`);

    try {
      return await this.oauthTokenService.getYouTubeAccessToken(data.userId);
    } catch (error) {
      this.logger.error(`TCP: Error getting YouTube access token ${data.userId}:`, error);
      throw error;
    }
  }

  /**
   * YouTube 권한 여부 확인 (TCP)
   */
  @MessagePattern(OAuthTcpPatterns.YOUTUBE_HAS_ACCESS)
  async hasYouTubeAccess(@Payload() data: TcpYouTubeTokenParams): Promise<boolean> {
    this.logger.log(`TCP: Checking YouTube access - userId: ${data.userId}`);

    try {
      return await this.oauthTokenService.hasYouTubeAccess(data.userId);
    } catch (error) {
      this.logger.error(`TCP: Error checking YouTube access ${data.userId}:`, error);
      throw error;
    }
  }
}
