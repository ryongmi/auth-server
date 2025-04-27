import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
  Session,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { Serialize, TransactionInterceptor } from '../../common/interceptors';
import { TransactionManager } from '../../common/decorators/transaction-manager.decorator';
import { OAuthStateGuard } from './guards/oauth-state.guard';
import { UserDto, CreateUserDto, LoginUserDto } from './dtos';
import {
  SwaagerApiTags,
  SwaagerApiBody,
  SwaagerApiOperation,
  SwaagerApiQuery,
  SwaagerApiOkResponse,
  SwaagerApiErrorResponse,
} from '../../common/decorators/swagger-api.decorator';

@SwaagerApiTags({ tags: ['auth'] })
@Controller()
@Serialize(UserDto)
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Get('/login-google')
  @SwaagerApiOperation({ summary: '구글 로그인' })
  @SwaagerApiOkResponse({
    status: 200,
    description: '구글 로그인 OAuth로 redirect 성공',
  })
  getLoginGoogle(@Res() res: Response) {
    const url =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      `?client_id=${this.config.get<string>('google.clientId')}` +
      `&redirect_uri=${this.config.get<string>('google.redirectUrl')}` +
      '&response_type=code' +
      '&scope=email profile';

    return res.redirect(url);
  }

  @Get('/login-google/callback')
  @SwaagerApiOperation({ summary: '구글 OAuth 정보 가져오기' })
  @SwaagerApiQuery({
    name: 'code',
    type: String,
    description: '구글에서 return시킨 code',
  })
  @SwaagerApiOkResponse({
    status: 200,
    description: '구글 로그인 성공',
    dto: UserDto,
  })
  @SwaagerApiErrorResponse({
    status: 500,
    description: '로그인중 서버에서 에러가 발생',
  })
  @UseInterceptors(TransactionInterceptor)
  async getLoginGoogleCallback(
    @Query('code') code: string,
    @Session() session: Record<string, any>,
    @TransactionManager() transactionManager: EntityManager,
  ) {
    return await this.authService
      .loginGoogle(transactionManager, code)
      .then(({ user, tokenData }) => {
        session.user = {
          id: user.id,
          // user_id: user.user_id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          profileImage: user.profileImage,
        };
        session.oauth = {
          id_token: tokenData.id_token,
          access_token: tokenData.access_token,
        };

        return user;
      });
  }

  @Get('/login-naver')
  @SwaagerApiOperation({ summary: '네이버 로그인' })
  @SwaagerApiOkResponse({
    status: 200,
    description: '네이버 로그인 OAuth로 redirect 성공',
  })
  getLoginNaver(@Res() res: Response, @Session() session: Record<string, any>) {
    // const state = randomBytes(16).toString('hex');
    // session.stateCheck = {
    //   state,
    //   createAt: new Date(),
    // };

    const state = this.authService.generateState();

    const url =
      'https://nid.naver.com/oauth2.0/authorize' +
      `?client_id=${this.config.get<string>('naver.clientId')}` +
      `&redirect_uri=${this.config.get<string>('naver.redirectUrl')}` +
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
    dto: UserDto,
  })
  @SwaagerApiErrorResponse({
    status: 500,
    description: '로그인중 서버에서 에러가 발생',
  })
  @UseGuards(OAuthStateGuard)
  @UseInterceptors(TransactionInterceptor)
  async getLoginNaverCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Session() session: Record<string, any>,
    @TransactionManager() transactionManager: EntityManager,
  ) {
    return await this.authService
      .loginNaver(transactionManager, code, state)
      .then(({ user, tokenData }) => {
        session.user = {
          id: user.id,
          // user_id: user.user_id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          profileImage: user.profileImage,
        };
        session.oauth = {
          refresh_token: tokenData.refresh_token,
          access_token: tokenData.access_token,
        };

        return user;
      });
  }

  @Post('/logout')
  @HttpCode(200)
  @SwaagerApiOperation({ summary: '로그아웃' })
  @SwaagerApiOkResponse({ status: 200, description: '로그아웃 성공' })
  @SwaagerApiErrorResponse({
    status: 500,
    description: '로그아웃중 서버에서 에러가 발생',
  })
  postLogout(@Session() session: Record<string, any>) {
    if (session.hasOwnProperty('user')) {
      delete session['user'];
    }
    if (session.hasOwnProperty('oauth')) {
      delete session['oauth'];
    }

    return null;
  }

  @Post('/login')
  @HttpCode(200)
  @SwaagerApiOperation({ summary: '로그인' })
  @SwaagerApiBody({
    dto: LoginUserDto,
    description: '사이트 로그인시 필요한 BODY값',
  })
  @SwaagerApiOkResponse({
    status: 200,
    description: '로그인 성공',
    dto: UserDto,
  })
  @SwaagerApiErrorResponse({
    status: 500,
    description: '로그인중 서버에서 에러가 발생',
  })
  async postLogin(
    @Body() body: LoginUserDto,
    @Session() session: Record<string, any>,
  ) {
    return await this.authService
      .login(body.email, body.password)
      .then((user) => {
        session.user = {
          id: user.id,
          // user_id: user.user_id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          profileImage: user.profileImage,
        };

        return user;
      });
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
    dto: UserDto,
  })
  @SwaagerApiErrorResponse({
    status: 500,
    description: '회원가입중 서버에서 에러가 발생',
  })
  @UseInterceptors(TransactionInterceptor)
  async postCreateUser(
    @Body() body: CreateUserDto,
    @TransactionManager() transactionManager: EntityManager,
  ) {
    return await this.authService.signup(transactionManager, body);
  }
}
