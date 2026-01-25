import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { OAuthTokenService } from './oauth-token.service.js';

@Controller()
export class OAuthTokenTcpController {
  private readonly logger = new Logger(OAuthTokenTcpController.name);

  constructor(private readonly oauthTokenService: OAuthTokenService) {}

  /**
   * YouTube 액세스 토큰 조회 (TCP)
   * 토큰이 만료 임박 시 자동 갱신
   */
  @MessagePattern('oauth.youtube.getAccessToken')
  async getYouTubeAccessToken(@Payload() data: { userId: string }) {
    this.logger.debug(`[TCP] oauth.youtube.getAccessToken - userId: ${data.userId}`);

    try {
      const result = await this.oauthTokenService.getYouTubeAccessToken(data.userId);

      this.logger.log(`[TCP] YouTube 토큰 조회 성공 - userId: ${data.userId}`);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };

      this.logger.error(`[TCP] YouTube 토큰 조회 실패`, {
        userId: data.userId,
        error: err.message || 'Unknown',
      });

      return {
        success: false,
        error: {
          code: err.code || 'OAUTH_ERROR',
          message: err.message || 'OAuth 토큰 조회 실패',
        },
      };
    }
  }

  /**
   * YouTube 권한 여부 확인 (TCP)
   */
  @MessagePattern('oauth.youtube.hasAccess')
  async hasYouTubeAccess(@Payload() data: { userId: string }) {
    this.logger.debug(`[TCP] oauth.youtube.hasAccess - userId: ${data.userId}`);

    try {
      const hasAccess = await this.oauthTokenService.hasYouTubeAccess(data.userId);

      this.logger.debug(
        `[TCP] YouTube 권한 확인 완료 - userId: ${data.userId}, hasAccess: ${hasAccess}`
      );

      return {
        success: true,
        data: { hasAccess },
      };
    } catch (error) {
      const err = error as { message?: string };

      this.logger.error(`[TCP] YouTube 권한 확인 실패`, {
        userId: data.userId,
        error: err.message || 'Unknown',
      });

      return {
        success: false,
        error: {
          code: 'OAUTH_ERROR',
          message: err.message || 'YouTube 권한 확인 실패',
        },
      };
    }
  }
}
