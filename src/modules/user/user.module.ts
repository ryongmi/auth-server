import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuthAccount, User } from './entities';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthService } from '../auth/auth.service';
import { GoogleOAuthService } from '../auth/google-oauth.service';
import { NaverOAuthService } from '../auth/naver-oauth.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, OAuthAccount]), HttpModule],
  controllers: [UserController],
  providers: [UserService, AuthService, GoogleOAuthService, NaverOAuthService], // 서비스를 providers에 추가
  exports: [UserService, AuthService], // 다른 모듈에서 User 서비스를 사용할 수 있도록 exports에 추가
})
export class UserModule {}
