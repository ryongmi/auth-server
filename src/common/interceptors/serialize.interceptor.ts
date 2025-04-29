import {
  UseInterceptors,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { plainToClass } from 'class-transformer';
import { Request } from 'express';

// 클래스를 의미하는 인터페이스
// any를 대체하고자 정의하였고, 어떤 내용이든 클래스면 만족함
interface ClassConstructor {
  new (...args: any[]): {};
}

export function Serialize(dto: ClassConstructor) {
  return UseInterceptors(new SerializerInterceptor(dto));
}

export class SerializerInterceptor implements NestInterceptor {
  constructor(private dto: any) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const statusCode = context.switchToHttp().getResponse().statusCode;

    console.log('body', req.body);
    console.log('session', req?.user);

    return next.handle().pipe(
      map((data: any) => {
        // 2. DTO 변환: 'data'가 객체일 때만 변환, 아니면 그대로 반환
        const responseData = plainToClass(this.dto, data, {
          excludeExtraneousValues: true,
        });

        return {
          statusCode: statusCode || HttpStatus.OK,
          // message: "Request successful",
          isLogin: req.cookies['refreshToken'] ? true : false,
          data: responseData,
        };
      }),
    );
  }
}
