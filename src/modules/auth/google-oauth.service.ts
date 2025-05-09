import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, map } from 'rxjs';
import { AuthException } from '../../exception';

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getGoogleUserInfo(code: string) {
    try {
      // 교환할 토큰 요청
      const tokenData = await lastValueFrom(
        this.httpService
          .post(this.config.get<string>('google.tokenUrl'), {
            code,
            client_id: this.config.get<string>('google.clientId'),
            client_secret: this.config.get<string>('google.clientSecret'),
            redirect_uri: this.config.get<string>('google.redirectUrl'),
            grant_type: 'authorization_code',
          })
          .pipe(map((response) => response.data)),
      );

      const accessToken = tokenData.access_token;

      // 사용자 정보 요청
      const googleUserInfo = await lastValueFrom(
        this.httpService
          .get(this.config.get<string>('google.userInfoUrl'), {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          .pipe(map((response) => response.data)),
      );

      return { tokenData, googleUserInfo };
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
