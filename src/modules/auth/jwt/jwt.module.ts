import { Module } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { JwtTokenService } from "./jwt-token.service";

@Module({
  providers: [JwtService, JwtTokenService],
  exports: [JwtTokenService], // JwtTokenService를 다른 모듈에서 사용 가능하도록 export
})
export class JwtModule {}
