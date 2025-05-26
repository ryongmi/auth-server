import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { HttpExceptionFilter } from "./common/filters";
import { LoggingInterceptor } from "./common/interceptors";
import { ConfigService } from "@nestjs/config";
// import { SeederService } from './seeder/seeder.service';

export async function setNestApp(app: INestApplication, configService: ConfigService) {
  const mode = configService.get<string>("mode") || "development";

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // req시 DTO에 없는 속성 자동제거
      // forbidNonWhitelisted: true, // 허용하지 않은 속성을 제거하는 대신 예외를 throw
      transform: true,
      // disableErrorMessages: true, // 유효성 검사에서 오류 반환시 오류 메시지를 없애줌
    })
  );

  const allowedOrigins =
    mode === "production"
      ? ["https://www.krgeobuk.com", "https://api.krgeobuk.com"] // 배포 도메인
      : ["http://localhost:8000", "http://127.0.0.1:8000"]; // 로컬 개발 도메인

  app.enableCors({
    origin: allowedOrigins, // 허용할 도메인
    credentials: true, // 쿠키를 포함한 요청 허용
  }); // cors 활성화

  app.use(cookieParser());

  // 모든 엔드포인트에 api 추가
  app.setGlobalPrefix("api");

  // 글로벌 Log 설정
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 글로벌 예외 Log 설정
  app.useGlobalFilters(new HttpExceptionFilter());

  // 테이블 초기 데이터 세팅
  // const seederService = app.get(SeederService);
  // await seederService.seed();
}
