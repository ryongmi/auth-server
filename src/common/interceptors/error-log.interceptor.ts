import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ErrorInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, params, query } = req;

    return next.handle().pipe(
      catchError((error) => {
        // 여기서 예상되는 예외를 필터링할 수 있습니다.
        // if (error instanceof ExpectedError) {
        // 예상되는 예외는 처리되지 않고 여기서 반환됩니다.
        //   return throwError(error);
        // }

        // HTTP 상태 코드를 가져옵니다.
        const statusCode = error.response?.statusCode || 500;
        const errorMessage = error.message || 'Unknown error';
        const logMessage = `${method} ${url} ${statusCode}: ${errorMessage}`;

        // 쿼리, 파라미터, 바디 값을 로그에 포함
        const queryParams = JSON.stringify(query);
        const routeParams = JSON.stringify(params);
        const requestBody = method !== 'GET' ? JSON.stringify(body) : null;

        let completeLogMessage = `${logMessage} \nQuery Params: ${queryParams} \nRoute Params: ${routeParams}`;
        if (requestBody) {
          completeLogMessage += ` \nBody: ${requestBody}`;
        }

        this.logger.error(completeLogMessage);

        return throwError(error);
      }),
    );
  }
}
