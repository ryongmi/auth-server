import { Module } from '@nestjs/common';

import { SerializerInterceptor } from '@krgeobuk/core/interceptors';

import { RedisModule, DatabaseModule } from '@database';
import { AppConfigModule } from '@config';

import { UserModule } from '@modules/user/index.js';
import { AuthModule } from '@modules/auth/index.js';
import { OAuthModule } from '@modules/oauth/index.js';

// import { SeederModule } from './seeder/seeder.module';

@Module({
  imports: [
    // SeederModule,
    AppConfigModule,
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
  providers: [SerializerInterceptor], // Reflector는 자동 주입됨
})
export class AppModule {}
