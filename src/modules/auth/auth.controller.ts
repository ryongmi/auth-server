import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';

import { Serialize } from '@krgeobuk/core/decorators';
import {
  LoginRequestDto,
  LoginResponseDto,
  SignupRequestDto,
  RefreshResponseDto,
} from '@krgeobuk/auth/dtos';
import {
  SwaggerApiTags,
  SwaggerApiBody,
  SwaggerApiOperation,
  // SwaggerApiQuery,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';

import { RefreshTokenGuard } from '@common/jwt/index.js';

import { AuthService } from './auth.service.js';

@SwaggerApiTags({ tags: ['auth'] })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/logout')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '로그아웃' })
  @SwaggerApiOkResponse({ status: 200, description: '로그아웃 성공' })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '로그아웃중 서버에서 에러가 발생',
  })
  @Serialize({
    message: '로그아웃 성공',
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    return await this.authService.logout(req, res);
  }

  @Post('/login')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '로그인' })
  @SwaggerApiBody({
    dto: LoginRequestDto,
    description: '사이트 로그인시 필요한 BODY값',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '로그인 성공',
    dto: LoginResponseDto,
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '로그인중 서버에서 에러가 발생',
  })
  @Serialize({
    dto: LoginResponseDto,
    message: '로그인 성공',
  })
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: LoginRequestDto
  ): Promise<LoginResponseDto> {
    const data = await this.authService.login(res, body);

    // 로그인시 로그인여부를 정확히 보내주기 위해 임의로 넣음
    req.user = data.user;

    return data;
  }

  @Post('/signup')
  @HttpCode(201)
  @SwaggerApiOperation({ summary: '회원가입' })
  @SwaggerApiBody({
    dto: SignupRequestDto,
    description: '회원가입시 필요한 BODY값',
  })
  @SwaggerApiOkResponse({
    status: 201,
    description: '회원가입 성공',
    dto: LoginResponseDto,
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '회원가입중 서버에서 에러가 발생',
  })
  @Serialize({
    dto: LoginResponseDto,
    message: '회원가입 성공',
  })
  async signup(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: SignupRequestDto
  ): Promise<LoginResponseDto> {
    const data = await this.authService.signup(res, body);

    // 로그인시 로그인여부를 정확히 보내주기 위해 임의로 넣음
    req.user = data.user;

    return data;
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @Serialize({
    dto: RefreshResponseDto,
    message: '토큰 재발급 성공',
  })
  async refresh(@Req() req: Request): Promise<RefreshResponseDto> {
    return await this.authService.refresh(req.jwt!);
  }
}
