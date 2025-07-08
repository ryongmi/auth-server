import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { WinstonModule } from 'nest-winston';

import { SerializerInterceptor } from '@krgeobuk/core/interceptors';
import { winstonConfig } from '@krgeobuk/core/logger';

import { RedisModule, DatabaseModule } from '@database/index.js';
import { AppConfigModule } from '@config/index.js';
import { UserModule } from '@modules/user/index.js';
import { AuthModule } from '@modules/auth/index.js';
import { OAuthModule } from '@modules/oauth/index.js';

// import { SeederModule } from './seeder/seeder.module';

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    AppConfigModule,
    // SeederModule,
    DatabaseModule,
    RedisModule,
    UserModule,
    AuthModule,
    OAuthModule,
    // RouterModule.register([
    //   {
    //     path: 'api',
    //     module: UserModule,
    //   },
    // ]),
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SerializerInterceptor,
    },
  ], // Reflector는 자동 주입됨
})
export class AppModule {}

