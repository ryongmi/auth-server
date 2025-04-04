import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleOAuthService } from '../auth/google-oauth.service';
import { NaverOAuthService } from '../auth/naver-oauth.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), HttpModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleOAuthService, NaverOAuthService], // 서비스를 providers에 추가
  exports: [AuthService], // 다른 모듈에서 User 서비스를 사용할 수 있도록 exports에 추가
})
export class UserModule {}
