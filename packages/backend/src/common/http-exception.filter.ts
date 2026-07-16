import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/** Normalizes every error response to one shape: { statusCode, error, message, path, timestamp }. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        error = payload;
        message = payload;
      } else {
        const p = payload as { error?: string; message?: string | string[] };
        error = p.error ?? exception.name;
        message = p.message ?? exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body: ErrorBody = {
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }
}
