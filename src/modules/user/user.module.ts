import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtModule } from '@common/jwt/index.js';

import { UserEntity } from './entities/user.entity.js';
import { UserController } from './user.controller.js';
import { UserTcpController } from './user-tcp.controller.js';
import { UserService } from './user.service.js';
import { UserRepository } from './user.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), JwtModule, HttpModule],
  controllers: [UserController, UserTcpController],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
