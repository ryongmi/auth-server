import {
  Controller,
  Get,
  HttpCode,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';
import { NaverOAuthCallbackQueryDto, GoogleOAuthCallbackQueryDto } from '@krgeobuk/oauth/dtos';
import { ProviderType } from '@krgeobuk/oauth/enum';
import { LoginResponseDto } from '@krgeobuk/auth/dtos';
import {
  SwaggerApiTags,
  // SwaggerApiBody,
  SwaggerApiOperation,
  SwaggerApiQuery,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';

import { OAuthService } from './oauth.service.js';
import { NaverOAuthStateGuard, GoogleOAuthStateGuard } from './guards/oauth-state.guard.js';

@SwaggerApiTags({ tags: ['oauth'] })
@Controller('oauth')
export class OAuthController {
  constructor(
    private configService: ConfigService,
    private oauthService: OAuthService
  ) {}

  @Get('login-google')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '구글 로그인' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '구글 로그인 OAuth로 redirect 성공',
  })
  async loginGoogle(@Res() res: Response): Promise<void> {
    const state = await this.oauthService.generateState(ProviderType.GOOGLE);
    const clientId = this.configService.get<string>('google.clientId');
    const redirectUrl = this.configService.get<string>('google.redirectUrl');

    const url =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUrl}` +
      '&response_type=code' +
      '&scope=email profile' +
      `&state=${state}`;

    return res.redirect(url);
  }

  @Get('login-google/callback')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '구글 OAuth 정보 가져오기' })
  @SwaggerApiQuery({
    name: 'code',
    type: String,
    description: '구글에서 return시킨 code',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '구글 로그인 성공',
    dto: LoginResponseDto,
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '로그인중 서버에서 에러가 발생',
  })
  @UseGuards(GoogleOAuthStateGuard)
  @UseInterceptors(TransactionInterceptor)
  @Serialize({
    dto: LoginResponseDto,
    message: '구글 로그인 성공',
  })
  async loginGoogleCallback(
    @Req() req: Request,
    // @Res를 사용하면 return data로 보내는게 아니라 res.json()으로 직접 응답값을 명시해야함
    // 하지만 { passthrough: true } 속성을 사용하면 return data 로 Nestjs에서 자동으로 응답하게 할수있음
    @Res({ passthrough: true }) res: Response,
    @Query() query: GoogleOAuthCallbackQueryDto,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<LoginResponseDto> {
    const data = await this.oauthService.loginGoogle(res, transactionManager, query);

    // 로그인시 로그인여부를 정확히 보내주기 위해 임의로 넣음
    req.user = data.user;

    return data;
  }

  @Get('/login-naver')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '네이버 로그인' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '네이버 로그인 OAuth로 redirect 성공',
  })
  async loginNaver(@Res() res: Response): Promise<void> {
    const state = await this.oauthService.generateState(ProviderType.NAVER);
    const clientId = this.configService.get<string>('naver.clientId');
    const redirectUrl = this.configService.get<string>('naver.redirectUrl');

    const url =
      'https://nid.naver.com/oauth2.0/authorize' +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUrl}` +
      '&response_type=code' +
      `&state=${state}`;

    return res.redirect(url);
  }

  @Get('/login-naver/callback')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '네이버 OAuth 정보 가져오기' })
  @SwaggerApiQuery({
    name: 'code',
    type: String,
    description: '네이버에서 return시킨 code',
  })
  @SwaggerApiQuery({
    name: 'state',
    type: String,
    description: '네이버 OAuth redirect전 서버에서 생성한 임의의 문자열',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '네이버 로그인 성공',
    dto: LoginResponseDto,
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '로그인중 서버에서 에러가 발생',
  })
  @UseGuards(NaverOAuthStateGuard)
  @UseInterceptors(TransactionInterceptor)
  @Serialize({
    dto: LoginResponseDto,
    message: '네이버 로그인 성공',
  })
  async loginNaverCallback(
    @Req() req: Request,
    // @Res를 사용하면 return data로 보내는게 아니라 res.json()으로 직접 응답값을 명시해야함
    // 하지만 { passthrough: true } 속성을 사용하면 return data 로 Nestjs에서 자동으로 응답하게 할수있음
    @Res({ passthrough: true }) res: Response,
    @Query() query: NaverOAuthCallbackQueryDto,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<LoginResponseDto> {
    const data = await this.oauthService.loginNaver(res, transactionManager, query);

    // 로그인시 로그인여부를 정확히 보내주기 위해 임의로 넣음
    req.user = data.user;

    return data;
  }
}
