import { Module } from '@nestjs/common';
// import { ConfigModule } from '@nestjs/config';
import { SharedRedisModule, REDIS_CLIENT_TOKEN } from '@krgeobuk/database-config'; // 공통 패키지에서 import

import { RedisService } from './redis.service.js';

@Module({
  imports: [
    // ConfigModule, // 환경변수 사용 시 필요
    SharedRedisModule.register(REDIS_CLIENT_TOKEN), // 공통 패키지의 Redis 모듈 사용
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

// import { Module, Global } from '@nestjs/common';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { createClient } from 'redis';

// @Global()
// @Module({
//   imports: [ConfigModule],
//   providers: [
//     {
//       provide: 'REDIS_CLIENT',
//       useFactory: async (configService: ConfigService) => {
//         const client = createClient({
//           // url: `redis://${configService.get<string>('db-redis.host')}:${configService.get<number>('db-redis.port')}`,
//           socket: {
//             host: `redis-auth-${configService.get<string>('mode')}`, // Redis 호스트 (Docker 컨테이너 이름)
//             port: configService.get<number>('db-redis.port'), // Redis 포트
//             // reconnectStrategy: (retries) => Math.min(retries * 50, 2000), // 재연결 전략
//           },
//           password: configService.get<string>('db-redis.password'), // Redis 비밀번호
//           legacyMode: true, // connect-redis 호환을 위한 설정
//           //   retry_strategy: (retries) => {
//           //     return Math.min(retries * 50, 1000);  // 재연결 시도 간격 설정
//           //   }
//         });

//         client.on('error', (err) => console.error('Redis Client Error:', err));
//         await client
//           .connect()
//           .catch((err) => console.error('Redis Connect Error:', err));

//         return client;
//       },
//       inject: [ConfigService],
//     },
//   ],
//   exports: ['REDIS_CLIENT'], // Redis 클라이언트를 내보내 다른 모듈에서 사용 가능
// })
// export class RedisModule {}

// import { Module } from "@nestjs/common";
// import { ConfigService } from "@nestjs/config";
// import { Redis } from "ioredis";
// import { RedisService } from "./redis.service";

// @Module({
//   providers: [
//     RedisService,
//     {
//       provide: "REDIS_CLIENT",
//       useFactory: async (configService: ConfigService) => {
//         // 최신 방식으로 Redis 클라이언트 생성
//         const client = new Redis({
//           host: configService.get<string>("db-redis.host"), // Redis 호스트
//           port: configService.get<number>("db-redis.port"), // Redis 포트
//           password: configService.get<string>("db-redis.password"), // Redis 비밀번호
//           // db: configService.get<number>('db-redis.dbIndex') || 0, // 선택적으로 DB 인덱스를 설정
//           // 추가적인 설정은 필요에 따라 추가 가능
//           reconnectOnError: (err) => {
//             console.log("Redis reconnect error:", err);
//             return true;
//           },
//           connectTimeout: 10000, // Redis 서버에 연결하는 데 걸리는 시간
//         });

//         client.on("connect", () => {
//           console.log("Redis client connected");
//         });

//         client.on("error", (err) => {
//           console.error("Redis client error:", err);
//         });

//         return client;
//       },
//       inject: [ConfigService], // ConfigService에서 Redis 설정을 가져옵니다.
//     },
//   ],
//   exports: [RedisService], // RedisService를 외부 모듈에서 사용할 수 있도록 내보냄
// })
// export class RedisModule {}
