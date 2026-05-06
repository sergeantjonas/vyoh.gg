import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from "@nestjs/common";
import { type Observable, tap } from "rxjs";

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<{ method: string; url: string }>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.getResponse<{ statusCode: number }>();
          const duration = Date.now() - start;
          this.logger.log(`${req.method} ${req.url} → ${res.statusCode} (${duration}ms)`);
        },
        error: (error: unknown) => {
          const duration = Date.now() - start;
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `${req.method} ${req.url} → ERROR (${duration}ms): ${message}`
          );
        },
      })
    );
  }
}
