import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { default as defaultConfig } from "./default";
import { mysqlConfig, redisConfig } from "./database";
import { naverConfig } from "./naver";
import { googleConfig } from "./google";
import { jwtConfig } from "./jwt";
import { validationSchema } from "./validation.schema";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // envFilePath: [`.env.${process.env.NODE_ENV}.local`],
      load: [defaultConfig, mysqlConfig, redisConfig, googleConfig, naverConfig, jwtConfig],
      validationSchema,
    }),
  ],
})
export class AppConfigModule {}
