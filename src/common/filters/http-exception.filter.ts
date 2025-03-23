import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const request = ctx.getRequest();
    const { method, url, query, params, body, session } = request;
    const queryParams = JSON.stringify(query);
    const routeParams = JSON.stringify(params);
    const requestBody = method !== 'GET' ? JSON.stringify(body) : null;

    const status = exception.getStatus();
    const error = exception.getResponse() as
      | string
      | { error: string; statusCode: number; message: string[] };

    let logMessage = `${method} ${url} ${status} \nException Message: ${exception.message}`;

    if (typeof error === 'string') {
      logMessage += `\nResponse  Message: ${error}`;
    } else {
      logMessage += `\nResponse  Message: ${error.message}`;
    }

    logMessage += `\nSession User: ${session?.user?.id ?? null} \nQuery Params: ${queryParams} \nRoute Params: ${routeParams}`;
    if (requestBody) {
      logMessage += ` \nBody: ${requestBody}`;
    }

    this.logger.error('logMessage', logMessage);
    this.logger.error('error', error);

    response.status(status).json({
      statusCode: status,
      error: 'Bad Request',
      message: 'Invalid input data',
      // timestamp: new Date().toISOString(),
      // path: url,
    });

    // response.status(status).json({
    //   status: 'error',
    //   message: exception.message,
    //   error: {
    //     code: status,
    //     details: exception.getResponse(),
    //   },
    // });
  }
}
