import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import cookieParser from 'cookie-parser';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { HttpExceptionFilter } from '@krgeobuk/core/filters';
import { LoggingInterceptor } from '@krgeobuk/core/interceptors';

import { DefaultConfig } from '@common/interfaces/index.js';
// import { SeederService } from './seeder/seeder.service';

export function setNestApp(
  app: INestApplication,
  configService: ConfigService<unknown, boolean>
): void {
  const corsOrigins = configService.get<DefaultConfig['corsOrigins']>('corsOrigins');
  const allowedOrigins = corsOrigins?.split(',').map((origin) => origin.trim()) || [];

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // req시 DTO에 없는 속성 자동제거
      // forbidNonWhitelisted: true, // 허용하지 않은 속성을 제거하는 대신 예외를 throw
      transform: true,
      // disableErrorMessages: true, // 유효성 검사에서 오류 반환시 오류 메시지를 없애줌
    })
  );

  app.enableCors({
    origin: allowedOrigins, // 허용할 도메인
    credentials: true, // 쿠키를 포함한 요청 허용
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      // API 기본 헤더
      'Content-Type',
      'Accept',

      // 인증 헤더
      'Authorization',
      'x-csrf-token',

      // 추적 헤더
      'x-request-id',

      // CORS 필수
      'Origin',

      // 브라우저 표준
      'User-Agent',
      'Accept-Language',
      'Accept-Encoding',
      'X-Requested-With',

      // 캐시 최적화
      'Cache-Control',
      'If-None-Match',
      'If-Modified-Since',
    ],
  }); // cors 활성화

  app.use(cookieParser());

  // 모든 엔드포인트에 api 추가
  app.setGlobalPrefix('api');

  // winston 설정
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // 글로벌 Log 설정
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 글로벌 예외 Log 설정
  app.useGlobalFilters(new HttpExceptionFilter());

  // 테이블 초기 데이터 세팅
  // const seederService = app.get(SeederService);
  // await seederService.seed();
}
