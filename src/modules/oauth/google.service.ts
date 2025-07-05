import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, map } from 'rxjs';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import { OAuthException } from '@krgeobuk/oauth/exception';
import { transformAndValidate } from '@krgeobuk/core/utils';

import { GoogleTokenResponseDto, GoogleUserProfileResponseDto } from '@krgeobuk/oauth/dtos';
import type { GoogleOAuthCallbackQuery, GoogleInfoResponse } from '@krgeobuk/oauth/interfaces';

import { GoogleConfig } from '@common/interfaces/index.js';

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService
  ) {}

  async getGoogleUserInfo(query: GoogleOAuthCallbackQuery): Promise<GoogleInfoResponse> {
    this.logger.log(`${this.getGoogleUserInfo.name} - 시작 되었습니다.`);

    const { code, state } = query;
    const client_id = this.config.get<GoogleConfig['clientId']>('google.clientId')!;
    const client_secret = this.config.get<GoogleConfig['clientSecret']>('google.clientSecret')!;
    const redirect_uri = this.config.get<GoogleConfig['redirectUrl']>('google.redirectUrl')!;
    const tokenUrl = this.config.get<GoogleConfig['tokenUrl']>('google.tokenUrl')!;
    const userInfoUrl = this.config.get<GoogleConfig['userInfoUrl']>('google.userInfoUrl')!;

    try {
      // 교환할 토큰 요청
      const tokenDataRaw = await lastValueFrom(
        this.httpService
          .post(tokenUrl, {
            code,
            state,
            client_id,
            client_secret,
            redirect_uri,
            grant_type: 'authorization_code',
          })
          .pipe(map((response) => response.data))
      );

      this.logger.log(`${this.getGoogleUserInfo.name} - Google 토큰 가져오기 성공.`);

      // 변환 + 유효성 검사
      const tokenData = await transformAndValidate<GoogleTokenResponseDto>({
        cls: GoogleTokenResponseDto,
        plain: tokenDataRaw,
      });

      this.logger.log(`${this.getGoogleUserInfo.name} - Google 토큰 유효성 검사 성공.`);

      const accessToken = tokenData.accessToken;

      // 사용자 정보 요청
      const googleUserInfoRaw = await lastValueFrom(
        this.httpService
          .get(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          .pipe(map((response) => response.data))
      );

      this.logger.log(`${this.getGoogleUserInfo.name} - Google 유저 정보 가져오기 성공.`);

      // 변환 + 유효성 검사
      const googleUserInfo = await transformAndValidate<GoogleUserProfileResponseDto>({
        cls: GoogleUserProfileResponseDto,
        plain: googleUserInfoRaw,
      });

      this.logger.log(`${this.getGoogleUserInfo.name} - 성공적으로 종료되었습니다.`);

      return { tokenData, googleUserInfo };
    } catch (error: unknown) {
      const message = `[${this.getGoogleUserInfo.name} Error] ${error instanceof Error ? error.message : String(error)}`;
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(message, stack);

      throw OAuthException.loginError(OAuthAccountProviderType.GOOGLE);
    }
  }
}
