import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { Agent, setGlobalDispatcher } from "undici";
import { AppModule } from "./app.module";
import { requireEnv } from "./env";
import { HttpLoggingInterceptor } from "./http-logging.interceptor";
import { RiotExceptionFilter } from "./riot/riot.exception-filter";

// Force undici to time out at the dispatcher level. AbortSignal alone has
// proven unreliable for fetches stalled in DNS / TLS handshake (notably
// under WSL2) — the signal fires but undici doesn't always interrupt the
// underlying socket, leaving the fetch promise pending forever and a
// Bottleneck slot wedged in `executing`. These three timeouts give us hard
// upper bounds at the layer that owns the connection.
setGlobalDispatcher(
  new Agent({
    connect: { timeout: 10_000 },
    headersTimeout: 10_000,
    bodyTimeout: 10_000,
  })
);

async function bootstrap() {
  requireEnv("DATABASE_URL");
  requireEnv("RIOT_API_KEY");

  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalFilters(new RiotExceptionFilter());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:2009",
  });
  const port = Number(process.env.PORT ?? 2010);
  await app.listen(port);
  console.log(`api listening on http://localhost:${port}`);
}

void bootstrap();
