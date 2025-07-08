import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtModule } from '@common/jwt/index.js';

import { UserEntity } from './entities/user.entity.js';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { UserRepository } from './user.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), JwtModule, HttpModule],
  controllers: [UserController],
  providers: [UserService, UserRepository], // 서비스를 providers에 추가
  exports: [UserService], // 다른 모듈에서 User 서비스를 사용할 수 있도록 exports에 추가
})
export class UserModule {}
