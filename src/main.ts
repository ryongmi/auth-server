import '@krgeobuk/core/interfaces/express';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { setupSwagger } from '@krgeobuk/swagger/config';

import { DefaultConfig } from '@common/interfaces/index.js';

import { AppModule } from './app.module.js';
import { setNestApp } from './setNestApp.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(
    AppModule,
    { bufferLogs: true } // 로거 준비 전에 로그 유실 방지
  );
  const configService = app.get(ConfigService);

  const port = configService.get<DefaultConfig['port']>('port')!;
  const tcpPort = configService.get<DefaultConfig['tcpPort']>('tcpPort')!;

  // 글로벌 설정
  setNestApp(app, configService);

  // Swagger 설정
  setupSwagger({ app, configService });

  // TCP 마이크로서비스 설정 (포트 8010)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: tcpPort,
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);
}
bootstrap();
