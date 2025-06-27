import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, map } from 'rxjs';

import { ProviderType } from '@krgeobuk/oauth/enum';
import { OAuthException } from '@krgeobuk/oauth/exception';
import { transformAndValidate } from '@krgeobuk/core/utils';
import { NaverTokenResponseDto, NaverUserProfileResponseDto } from '@krgeobuk/oauth/dtos';
import type { NaverOAuthCallbackQuery, NaverInfoResponse } from '@krgeobuk/oauth/interfaces';

import { NaverConfig } from '@common/interfaces/index.js';

@Injectable()
export class NaverOAuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService
  ) {}

  async getNaverUserInfo(query: NaverOAuthCallbackQuery): Promise<NaverInfoResponse> {
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

      // 변환 + 유효성 검사
      const tokenData = await transformAndValidate<NaverTokenResponseDto>({
        cls: NaverTokenResponseDto,
        plain: tokenDataRaw,
      });

      const accessToken = tokenData.accessToken;

      // 사용자 정보 요청
      const naverUserInfoRaw = await lastValueFrom(
        this.httpService
          .get(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          .pipe(map((response) => response.data.response))
      );

      // 변환 + 유효성 검사
      const naverUserInfo = await transformAndValidate<NaverUserProfileResponseDto>({
        cls: NaverUserProfileResponseDto,
        plain: naverUserInfoRaw,
      });

      return { tokenData, naverUserInfo };
    } catch (error: unknown) {
      // if (error.isAxiosError) {
      //   // AxiosError를 확인하고 처리
      //   throw new InternalServerErrorException(
      //     'Failed to fetch user info',
      //     error.message,
      //   );
      // }
      // throw new InternalServerErrorException(
      //   'Unexpected error occurred',
      //   error.message,
      // );
      console.log('네이버 로그인 실패', error);
      throw OAuthException.loginError(ProviderType.NAVER);
    }
  }
}
