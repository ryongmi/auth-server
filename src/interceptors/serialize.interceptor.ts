import '@krgeobuk/core/interfaces/express';

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { Request } from 'express';

interface SerializeOptions<T = unknown> {
  code?: string;
  message?: string;
  dto?: ClassConstructor<T>;
}

const CoreCode = {
  // 000 ~ 099	에러 코드
  SERVER_ERROR: 'CORE_000',
  BAD_REQUEST: 'CORE_001',
  UNAUTHORIZED: 'CORE_002',
  FORBIDDEN: 'CORE_003',

  // 200 ~ 299	성공 응답 코드
  REQUEST_SUCCESS: 'CORE_200',
} as const;

const SERIALIZE_META_KEY = 'serialize:meta';

@Injectable()
export class SerializerInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const statusCode = context.switchToHttp().getResponse().statusCode;

    const options: SerializeOptions =
      this.reflector.get<SerializeOptions>(SERIALIZE_META_KEY, context.getHandler()) || {};

    return next.handle().pipe(
      map((data: object | null) => {
        const transformed =
          options.dto !== undefined
            ? plainToInstance(options.dto, data, {
                excludeExtraneousValues: true,
              })
            : data;

        debugger;
        console.log(transformed);

        const responseData = toSnakeCase(transformed);

        return {
          code: options?.code || CoreCode.REQUEST_SUCCESS,
          status_code: statusCode || HttpStatus.OK,
          message: options?.message || 'test',
          isLogin: Boolean(req?.user),
          // Boolean(req.cookies['refreshToken']) ||
          // 'accessToken' in transformed,
          data: responseData,
        };
      })
    );
  }
}

import { snakeCase } from 'lodash-es';

function toSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 순회 제외할 타입들
  if (
    obj instanceof Date ||
    obj instanceof RegExp ||
    obj instanceof Set ||
    obj instanceof Map ||
    typeof obj === 'bigint' ||
    typeof obj === 'symbol'
  ) {
    return obj;
  }

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [snakeCase(key), toSnakeCase(value)])
  );
}
