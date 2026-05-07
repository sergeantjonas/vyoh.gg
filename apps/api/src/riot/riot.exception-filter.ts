import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from "@nestjs/common";
import { RateLimiterTimeoutError, RiotError } from "./riot.error";

@Catch(RiotError)
export class RiotExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RiotExceptionFilter.name);

  catch(exception: RiotError, host: ArgumentsHost): void {
    this.logger.warn(
      `Riot ${exception.status} on ${exception.path}: ${exception.message}`
    );

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    const status = mapStatus(exception);
    const message = mapMessage(exception);

    response.status(status).json({ statusCode: status, message });
  }
}

function mapStatus(exception: RiotError): number {
  if (exception instanceof RateLimiterTimeoutError) return 503;
  if (exception.status === 404 || exception.status === 429 || exception.status === 504) {
    return exception.status;
  }
  return 502;
}

function mapMessage(exception: RiotError): string {
  if (exception instanceof RateLimiterTimeoutError) {
    return "Upstream rate limit saturated — please retry in a moment";
  }
  if (exception.status === 404) return "Summoner not found";
  if (exception.status === 429) return "Rate limit exceeded — try again shortly";
  if (exception.status === 504) return "Riot API timed out — please retry";
  return "Upstream service error";
}
