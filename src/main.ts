import '@krgeobuk/core/interfaces/express';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { setupSwagger } from '@krgeobuk/swagger/config';

import { AppModule } from './app.module.js';
import { setNestApp } from './setNestApp.js';

import { DefaultConfig } from '@common/interfaces/index.js';

async function bootstrap(): Promise<void> {
  // const app = await NestFactory.create(AppModule);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);

  const port = configService.get<DefaultConfig['port']>('port')!;

  //
  // 글로벌 설정
  setNestApp(app, configService);
  // Swagger 설정
  // setSwagger(app);
  setupSwagger({ app, configService });

  await app.listen(port);
}
bootstrap();
