import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, map } from 'rxjs';

import { ProviderType } from '@krgeobuk/oauth/enum';
import { OAuthException } from '@krgeobuk/oauth/exception';
import { transformAndValidate } from '@krgeobuk/core/utils';

import { GoogleTokenResponseDto, GoogleUserProfileResponseDto } from '@krgeobuk/oauth/dtos';
import type { GoogleOAuthCallbackQuery, GoogleInfoResponse } from '@krgeobuk/oauth/interfaces';

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService
  ) {}

  async getGoogleUserInfo(query: GoogleOAuthCallbackQuery): Promise<GoogleInfoResponse> {
    const { code, state } = query;
    const client_id = this.config.get<string>('google.clientId')!;
    const client_secret = this.config.get<string>('google.clientSecret')!;
    const redirect_uri = this.config.get<string>('google.redirectUrl')!;
    const tokenUrl = this.config.get<string>('google.tokenUrl')!;
    const userInfoUrl = this.config.get<string>('google.userInfoUrl')!;

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

      // 변환 + 유효성 검사
      const tokenData = await transformAndValidate<GoogleTokenResponseDto>({
        cls: GoogleTokenResponseDto,
        plain: tokenDataRaw,
      });

      const accessToken = tokenData.accessToken;

      // 사용자 정보 요청
      const googleUserInfoRaw = await lastValueFrom(
        this.httpService
          .get(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          .pipe(map((response) => response.data))
      );

      // 변환 + 유효성 검사
      const googleUserInfo = await transformAndValidate<GoogleUserProfileResponseDto>({
        cls: GoogleUserProfileResponseDto,
        plain: googleUserInfoRaw,
      });

      return { tokenData, googleUserInfo };
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
      console.log('구글 로그인 실패', error);
      throw OAuthException.loginError(ProviderType.GOOGLE);
    }
  }
}
