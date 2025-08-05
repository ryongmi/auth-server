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

import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';

import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';
import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
import {
  AuthLoginRequestDto,
  AuthLoginResponseDto,
  AuthSignupRequestDto,
  AuthRefreshResponseDto,
} from '@krgeobuk/auth/dtos';
import { AuthError } from '@krgeobuk/auth/exception';
import { AuthResponse } from '@krgeobuk/auth/response';
import {
  SwaggerApiTags,
  SwaggerApiBody,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';

import { RefreshTokenGuard } from '@common/jwt/index.js';

import { AuthService } from './auth.service.js';

@SwaggerApiTags({ tags: ['auth'] })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('/login')
  @SwaggerApiOperation({ summary: 'SSO 로그인 리다이렉트' })
  @SwaggerApiOkResponse({
    status: 302,
    description: 'Auth Client로 리다이렉트',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '잘못된 리다이렉트 URI',
  })
  async ssoLoginRedirect(
    @Query('redirect_uri') redirectUri: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<void> {
    return await this.authService.ssoLoginRedirect(redirectUri, res);
  }

  @Post('/logout')
  @HttpCode(AuthResponse.LOGOUT_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '로그아웃' })
  @SwaggerApiOkResponse({
    status: AuthResponse.LOGOUT_SUCCESS.statusCode,
    description: AuthResponse.LOGOUT_SUCCESS.message,
  })
  @SwaggerApiErrorResponse({
    status: AuthError.LOGOUT_ERROR.statusCode,
    description: AuthError.LOGOUT_ERROR.message,
  })
  @Serialize({
    ...AuthResponse.LOGOUT_SUCCESS,
    // message: '로그아웃 성공',
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    return await this.authService.logout(req, res);
  }

  @Post('/login')
  @HttpCode(AuthResponse.LOGIN_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '로그인' })
  @SwaggerApiBody({
    dto: AuthLoginRequestDto,
    description: '사이트 로그인시 필요한 BODY값',
  })
  @SwaggerApiOkResponse({
    status: AuthResponse.LOGIN_SUCCESS.statusCode,
    description: AuthResponse.LOGIN_SUCCESS.message,
    dto: AuthLoginResponseDto,
  })
  @SwaggerApiErrorResponse({
    status: AuthError.LOGIN_ERROR.statusCode,
    description: AuthError.LOGIN_ERROR.message,
  })
  @Serialize({
    dto: AuthLoginResponseDto,
    ...AuthResponse.LOGIN_SUCCESS,
  })
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: AuthLoginRequestDto,
    @Query('redirect_session') redirectSession?: string
  ): Promise<AuthLoginResponseDto | void> {
    const data = await this.authService.login(res, body, redirectSession);

    // SSO 리다이렉트 처리
    if (redirectSession && typeof data === 'string') {
      return res.redirect(data);
    }

    // 로그인시 로그인여부를 정확히 보내주기 위해 임의로 넣음
    req.user = (data as AuthLoginResponseDto).user;

    return data as AuthLoginResponseDto;
  }

  @Post('/signup')
  @HttpCode(AuthResponse.SIGNUP_SUCCESS.statusCode)
  @UseInterceptors(TransactionInterceptor)
  @SwaggerApiOperation({ summary: '회원가입' })
  @SwaggerApiBody({
    dto: AuthSignupRequestDto,
    description: '회원가입시 필요한 BODY값',
  })
  @SwaggerApiOkResponse({
    status: AuthResponse.SIGNUP_SUCCESS.statusCode,
    description: AuthResponse.SIGNUP_SUCCESS.message,
    dto: AuthLoginResponseDto,
  })
  @SwaggerApiErrorResponse({
    status: AuthError.SIGNUP_ERROR.statusCode,
    description: AuthError.SIGNUP_ERROR.message,
  })
  @Serialize({
    dto: AuthLoginResponseDto,
    ...AuthResponse.SIGNUP_SUCCESS,
  })
  async signup(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: AuthSignupRequestDto,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<AuthLoginResponseDto> {
    const data = await this.authService.signup(res, body, transactionManager);

    // 로그인시 로그인여부를 정확히 보내주기 위해 임의로 넣음
    req.user = data.user;

    return data;
  }

  @Post('refresh')
  @HttpCode(AuthResponse.REFRESH_SUCCESS.statusCode)
  @SwaggerApiOperation({ summary: '토큰 재발급' })
  @SwaggerApiOkResponse({
    status: AuthResponse.REFRESH_SUCCESS.statusCode,
    description: AuthResponse.REFRESH_SUCCESS.message,
    dto: AuthRefreshResponseDto,
  })
  @SwaggerApiErrorResponse({
    status: AuthError.REFRESH_ERROR.statusCode,
    description: AuthError.REFRESH_ERROR.message,
  })
  @UseGuards(RefreshTokenGuard)
  @Serialize({
    dto: AuthRefreshResponseDto,
    ...AuthResponse.REFRESH_SUCCESS,
  })
  async refresh(@CurrentJwt() jwt: JwtPayload): Promise<AuthRefreshResponseDto> {
    return await this.authService.refresh(jwt);
  }

}
