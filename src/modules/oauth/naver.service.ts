import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { lastValueFrom, map } from 'rxjs';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import { OAuthException } from '@krgeobuk/oauth/exception';
import { transformAndValidate } from '@krgeobuk/core/utils';
import { NaverTokenResponseDto, NaverUserProfileResponseDto } from '@krgeobuk/oauth/dtos';
import type { NaverOAuthCallbackQuery, NaverInfoResponse } from '@krgeobuk/oauth/interfaces';

import { NaverConfig } from '@common/interfaces/index.js';

@Injectable()
export class NaverOAuthService {
  private readonly logger = new Logger(NaverOAuthService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService
  ) {}

  async getNaverUserInfo(query: NaverOAuthCallbackQuery): Promise<NaverInfoResponse> {
    this.logger.log(`${this.getNaverUserInfo.name} - 시작 되었습니다.`);

    const { code, state } = query;
    const client_id = this.config.get<NaverConfig['clientId']>('naver.clientId')!;
    const client_secret = this.config.get<NaverConfig['clientSecret']>('naver.clientSecret')!;
    const redirect_uri = this.config.get<NaverConfig['redirectUrl']>('naver.redirectUrl')!;
    const tokenUrl = this.config.get<NaverConfig['tokenUrl']>('naver.tokenUrl')!;
    const userInfoUrl = this.config.get<NaverConfig['userInfoUrl']>('naver.userInfoUrl')!;

    try {
      // 교환할 토큰 요청
      const tokenDataRaw = await lastValueFrom(
        this.httpService
          .get(tokenUrl, {
            headers: {
              'X-Naver-Client-Id': client_id,
              'X-Naver-Client-Secret': client_secret,
            },
            params: {
              client_id,
              client_secret,
              redirect_uri,
              code,
              state,
              grant_type: 'authorization_code',
            },
          })
          .pipe(map((response) => response.data))
      );

      this.logger.log(`${this.getNaverUserInfo.name} - Naver 토큰 가져오기 성공.`);

      // 변환 + 유효성 검사
      const tokenData = await transformAndValidate<NaverTokenResponseDto>({
        cls: NaverTokenResponseDto,
        plain: tokenDataRaw,
      });

      this.logger.log(`${this.getNaverUserInfo.name} - Naver 토큰 유효성 검사 성공.`);

      const accessToken = tokenData.accessToken;

      // 사용자 정보 요청
      const naverUserInfoRaw = await lastValueFrom(
        this.httpService
          .get(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          .pipe(map((response) => response.data.response))
      );

      this.logger.log(`${this.getNaverUserInfo.name} - Naver 유저 정보 가져오기 성공.`);

      // 변환 + 유효성 검사
      const naverUserInfo = await transformAndValidate<NaverUserProfileResponseDto>({
        cls: NaverUserProfileResponseDto,
        plain: naverUserInfoRaw,
      });

      this.logger.log(`${this.getNaverUserInfo.name} - 성공적으로 종료되었습니다.`);

      return { tokenData, naverUserInfo };
    } catch (error: unknown) {
      const message = `[${this.getNaverUserInfo.name} Error] ${error instanceof Error ? error.message : String(error)}`;
      const stack = error instanceof Error ? error.stack : '';

      this.logger.error(message, stack);

      throw OAuthException.loginError(OAuthAccountProviderType.NAVER);
    }
  }
}
