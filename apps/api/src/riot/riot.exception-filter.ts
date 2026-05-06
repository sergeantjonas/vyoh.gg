import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from "@nestjs/common";
import { RiotError } from "./riot.error";

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

    const status = mapStatus(exception.status);
    const message = mapMessage(exception.status);

    response.status(status).json({ statusCode: status, message });
  }
}

function mapStatus(riotStatus: number): number {
  if (riotStatus === 404 || riotStatus === 429) return riotStatus;
  return 502;
}

function mapMessage(riotStatus: number): string {
  if (riotStatus === 404) return "Summoner not found";
  if (riotStatus === 429) return "Rate limit exceeded — try again shortly";
  return "Upstream service error";
}
