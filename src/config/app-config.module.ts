import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { default as defaultConfig } from './default.js';
import { mysqlConfig, redisConfig } from './database.js';
import { naverConfig } from './naver.js';
import { googleConfig } from './google.js';
import { jwtConfig } from './jwt.js';
import { validationSchema } from './validation.schema.js';

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
