import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { lastValueFrom, map } from "rxjs";
import { AuthException } from "../../exception";

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService
  ) {}

  async getGoogleUserInfo(code: string) {
    try {
      const client_id = this.config.get<string>("google.clientId")!;
      const client_secret = this.config.get<string>("google.clientSecret")!;
      const redirect_uri = this.config.get<string>("google.redirectUrl")!;
      const tokenUrl = this.config.get<string>("google.tokenUrl")!;
      const userInfoUrl = this.config.get<string>("google.userInfoUrl")!;

      // 교환할 토큰 요청
      const tokenData = await lastValueFrom(
        this.httpService
          .post(tokenUrl, {
            code,
            client_id,
            client_secret,
            redirect_uri,
            grant_type: "authorization_code",
          })
          .pipe(map((response) => response.data))
      );

      const accessToken = tokenData.access_token;

      // 사용자 정보 요청
      const googleUserInfo = await lastValueFrom(
        this.httpService
          .get(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          .pipe(map((response) => response.data))
      );

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
      console.log("구글 로그인 실패", error);
      throw AuthException.authLoginError();
    }
  }
}
