// import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/app-config.module";
import { RedisModule, DatabaseModule } from "./database";
import { UserModule } from "./modules/user/user.module";
import { AuthModule } from "./modules/auth/auth.module";
import { SeederModule } from "./seeder/seeder.module";
import { SerializerInterceptor } from "./common/interceptors";

@Module({
  imports: [
    SeederModule,
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    UserModule,
    AuthModule,
    // RouterModule.register([
    //   {
    //     path: 'api',
    //     module: UserModule,
    //   },
    // ]),
  ],
  providers: [SerializerInterceptor], // Reflector는 자동 주입됨
})
export class AppModule {
  // 모든 컨트롤러에 들어오는 요청을 미들웨어에 통과시킴
  // constructor(private readonly sessionConfig: SessionConfig) {}
  // configure(consumer: MiddlewareConsumer) {
  //   consumer
  //     .apply(this.sessionConfig.getSessionMiddleware())
  //     .forRoutes({ path: '*', method: RequestMethod.ALL }); // 모든 경로에 세션 미들웨어 적용
  // }
}
