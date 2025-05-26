import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OAuthAccount, User } from "./entities";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { UserRepository } from "./user.repositoty";

@Module({
  imports: [TypeOrmModule.forFeature([User, OAuthAccount]), HttpModule],
  controllers: [UserController],
  providers: [UserService, UserRepository], // 서비스를 providers에 추가
  exports: [UserService], // 다른 모듈에서 User 서비스를 사용할 수 있도록 exports에 추가
})
export class UserModule {}
