import {
  UseInterceptors,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { plainToClass } from 'class-transformer';

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
    const req = context.switchToHttp().getRequest();
    const statusCode = context.switchToHttp().getResponse().statusCode;

    console.log('body', req.body);
    console.log('session', req.session);

    return next.handle().pipe(
      map((data: any) => {
        console.log('response DTO 적용');
        return {
          statusCode,
          // message: "Request successful",
          isLogin: req?.session?.user ? true : false,
          data: plainToClass(this.dto, data, {
            // Convert instance to plain object and then back to class to trigger @Expose() decorators
            excludeExtraneousValues: true,
          }),
        };
      }),
    );
  }
}
