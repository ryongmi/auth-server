import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { TransactionInterceptor } from '../../common/interceptors';
import { Serialize, TransactionManager } from '../../common/decorators';
import { OAuthStateGuard, RefreshTokenGuard } from './guards';
import { CreateUserDto, UserLoginDto, LoginResponseDto } from '../user/dtos';
import {
  SwaagerApiTags,
  SwaagerApiBody,
  SwaagerApiOperation,
  SwaagerApiQuery,
  SwaagerApiOkResponse,
  SwaagerApiErrorResponse,
} from '../../common/decorators';

@SwaagerApiTags({ tags: ['auth'] })
@Controller()
export class AuthController {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  @Get('login-google')
  @SwaagerApiOperation({ summary: '구글 로그인' })
  @SwaagerApiOkResponse({
    status: 200,
    description: '구글 로그인 OAuth로 redirect 성공',
  })
  getLoginGoogle(@Res() res: Response) {
    const clientId = this.configService.get<string>('google.clientId');
    const redirectUrl = this.configService.get<string>('google.redirectUrl');

    const url =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUrl}` +
      '&response_type=code' +
      '&scope=email profile';

    return res.redirect(url);
  }

  @Get('login-google/callback')
  @SwaagerApiOperation({ summary: '구글 OAuth 정보 가져오기' })
  @SwaagerApiQuery({
    name: 'code',
    type: String,
    description: '구글에서 return시킨 code',
  })
  @SwaagerApiOkResponse({
    status: 200,
    description: '구글 로그인 성공',
    dto: LoginResponseDto,
  })
  @SwaagerApiErrorResponse({
    status: 500,
    description: '로그인중 서버에서 에러가 발생',
  })
  @UseInterceptors(TransactionInterceptor)
  @Serialize({
    dto: LoginResponseDto,
    message: '구글 로그인 성공',
  })
  async getLoginGoogleCallback(
    // @Res를 사용하면 return data로 보내는게 아니라 res.json()으로 직접 응답값을 명시해야함
    // 하지만 { passthrough: true } 속성을 사용하면 return data 로 Nestjs에서 자동으로 응답하게 할수있음
    @Res({ passthrough: true }) res: Response,
    @Query('code') code: string,
    @TransactionManager() transactionManager: EntityManager,
  ) {
    const data = await this.authService.loginGoogle(
      res,
      transactionManager,
      code,
    );

    return data;
  }

  @Get('/login-naver')
  @SwaagerApiOperation({ summary: '네이버 로그인' })
  @SwaagerApiOkResponse({
    status: 200,
    description: '네이버 로그인 OAuth로 redirect 성공',
  })
  async getLoginNaver(@Res() res: Response) {
    const state = await this.authService.generateState();
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
  @SwaagerApiOperation({ summary: '네이버 OAuth 정보 가져오기' })
  @SwaagerApiQuery({
    name: 'code',
    type: String,
    description: '네이버에서 return시킨 code',
  })
  @SwaagerApiQuery({
    name: 'state',
    type: String,
    description: '네이버 OAuth redirect전 서버에서 생성한 임의의 문자열',
  })
  @SwaagerApiOkResponse({
    status: 200,
    description: '네이버 로그인 성공',
    dto: LoginResponseDto,
  })
  @SwaagerApiErrorResponse({
    status: 500,
    description: '로그인중 서버에서 에러가 발생',
  })
  @UseGuards(OAuthStateGuard)
  @UseInterceptors(TransactionInterceptor)
  @Serialize({
    dto: LoginResponseDto,
    message: '네이버버 로그인 성공',
  })
  async getLoginNaverCallback(
    // @Res를 사용하면 return data로 보내는게 아니라 res.json()으로 직접 응답값을 명시해야함
    // 하지만 { passthrough: true } 속성을 사용하면 return data 로 Nestjs에서 자동으로 응답하게 할수있음
    @Res({ passthrough: true }) res: Response,
    @Query('code') code: string,
    @Query('state') state: string,
    @TransactionManager() transactionManager: EntityManager,
  ) {
    const data = await this.authService.loginNaver(
      res,
      transactionManager,
      code,
      state,
    );

    return data;
  }

  @Post('/logout')
  @HttpCode(200)
  @SwaagerApiOperation({ summary: '로그아웃' })
  @SwaagerApiOkResponse({ status: 200, description: '로그아웃 성공' })
  @SwaagerApiErrorResponse({
    status: 500,
    description: '로그아웃중 서버에서 에러가 발생',
  })
  @Serialize({
    message: '로그아웃 성공',
  })
  async postLogout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req, res);

    return null;
  }

  @Post('/login')
  @HttpCode(200)
  @SwaagerApiOperation({ summary: '로그인' })
  @SwaagerApiBody({
    dto: UserLoginDto,
    description: '사이트 로그인시 필요한 BODY값',
  })
  @SwaagerApiOkResponse({
    status: 200,
    description: '로그인 성공',
    dto: LoginResponseDto,
  })
  @SwaagerApiErrorResponse({
    status: 500,
    description: '로그인중 서버에서 에러가 발생',
  })
  @Serialize({
    dto: LoginResponseDto,
    message: '로그인 성공',
  })
  async postLogin(
    @Res({ passthrough: true }) res: Response,
    @Body() body: UserLoginDto,
  ) {
    const data = await this.authService.login(res, body);

    return data;
  }

  @Post('/signup')
  @HttpCode(201)
  @SwaagerApiOperation({ summary: '회원가입' })
  @SwaagerApiBody({
    dto: CreateUserDto,
    description: '회원가입시 필요한 BODY값',
  })
  @SwaagerApiOkResponse({
    status: 201,
    description: '회원가입 성공',
    dto: LoginResponseDto,
  })
  @SwaagerApiErrorResponse({
    status: 500,
    description: '회원가입중 서버에서 에러가 발생',
  })
  @UseInterceptors(TransactionInterceptor)
  @Serialize({
    dto: LoginResponseDto,
    message: '회원가입 성공',
  })
  async postCreateUser(
    @Res({ passthrough: true }) res: Response,
    @TransactionManager() transactionManager: EntityManager,
    @Body() body: CreateUserDto,
  ) {
    const data = await this.authService.signup(res, transactionManager, body);

    return data;
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @Serialize({
    dto: LoginResponseDto,
    message: '토큰 재발급 성공',
  })
  async postRefresh(@Req() req: Request) {
    const accessToken = await this.authService.getNewAccessToken(req.user);
    return { accessToken };
  }
}
