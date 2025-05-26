import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { setNestApp } from "./setNestApp";
import { setSwagger } from "./setSwaager";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>("port") || 8000;

  // 글로벌 설정
  setNestApp(app, configService);
  // Swagger 설정
  setSwagger(app);

  await app.listen(port);
}
bootstrap();
