import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, map } from 'rxjs';
import { AuthException } from '../../exception';

@Injectable()
export class NaverOAuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getNaverUserInfo(code: string, state: string) {
    const client_id = this.config.get<string>('naver.clientId');
    const client_secret = this.config.get<string>('naver.clientSecret');
    const redirect_uri = this.config.get<string>('naver.redirectUrl');

    try {
      // 교환할 토큰 요청
      const tokenData = await lastValueFrom(
        this.httpService
          .get(this.config.get<string>('naver.tokenUrl'), {
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
          .pipe(map((response) => response.data)),
      );

      const accessToken = tokenData.access_token;

      // 사용자 정보 요청
      const naverUserInfo = await lastValueFrom(
        this.httpService
          .get(this.config.get<string>('naver.userInfoUrl'), {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          .pipe(map((response) => response.data.response)),
      );

      return { tokenData, naverUserInfo };
    } catch (error) {
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
      throw AuthException.authLoginError();
    }
  }
}
