import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { WinstonModule } from 'nest-winston';

import { SerializerInterceptor } from '@krgeobuk/core/interceptors';
import { winstonConfig } from '@krgeobuk/core/logger';

import { RedisModule, DatabaseModule } from '@database/index.js';
import { AppConfigModule } from '@config/index.js';
import { SharedClientsModule } from '@common/clients/shared-clients.module.js';
import { UserModule } from '@modules/user/index.js';
import { AuthModule } from '@modules/auth/index.js';
import { OAuthModule } from '@modules/oauth/index.js';
import { AccountMergeModule } from '@modules/account-merge/account-merge.module.js';
import { ImageModule } from '@modules/image/image.module.js';
import { HealthModule } from '@modules/health/index.js';

// import { SeederModule } from './seeder/seeder.module';

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    AppConfigModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 1000, // 1초
          limit: 3, // 1초에 3번
        },
        {
          name: 'medium',
          ttl: 10000, // 10초
          limit: 20, // 10초에 20번
        },
        {
          name: 'long',
          ttl: 60000, // 1분
          limit: 100, // 1분에 100번
        },
      ],
    }),
    // TCP 연결 모듈
    SharedClientsModule,
    // SeederModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    UserModule,
    AuthModule,
    OAuthModule,
    AccountMergeModule,
    ImageModule,
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
