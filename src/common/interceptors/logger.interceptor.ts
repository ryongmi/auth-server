import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, query, params, body, session } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const { statusCode } = response;
        const responseTime = Date.now() - startTime;

        const logMessage = `${method} ${url} ${statusCode} - ${responseTime}ms`;

        const queryParams = JSON.stringify(query);
        const routeParams = JSON.stringify(params);
        const requestBody = method !== "GET" ? JSON.stringify(body) : null;

        let completeLogMessage = `${logMessage} \nSession User: ${session?.user?.id ?? null} \nQuery Params: ${queryParams} \nRoute Params: ${routeParams}`;
        if (requestBody) {
          completeLogMessage += ` \nBody: ${requestBody}`;
        }

        this.logger.log(completeLogMessage);
      })
    );
  }
}
