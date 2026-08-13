import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { requireEnv, resolveCorsOrigin } from "./env";
import { HttpLoggingInterceptor } from "./http-logging.interceptor";
import { RiotExceptionFilter } from "./riot/riot.exception-filter";

async function bootstrap() {
  requireEnv("DATABASE_URL");
  requireEnv("RIOT_API_KEY");
  // Owner auth. Missing here means the api boots with a login route that can
  // never succeed — better to fail at start than to look healthy and lock the
  // owner out of their own status page. `SESSION_COOKIE_DOMAIN` is deliberately
  // absent: empty is its correct dev value, which `requireEnv` rejects.
  requireEnv("OWNER_GITHUB_USER_ID");
  requireEnv("GITHUB_OAUTH_CLIENT_ID");
  requireEnv("GITHUB_OAUTH_CLIENT_SECRET");
  requireEnv("SESSION_SECRET");
  // Only in production: unset, `resolveCorsOrigin` falls back to any localhost
  // port, which is right for dev and wrong for a public deploy.
  if (process.env.NODE_ENV === "production") requireEnv("WEB_ORIGIN");

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Nothing downstream reads `req.ip` today, but Express resolves it to
  // nginx's loopback address unless told how many proxies sit in front. Set it
  // now so a future app-level rate limiter cannot silently bucket every visitor
  // as one client. Exactly one hop — `true` would trust the whole
  // X-Forwarded-For chain, whose client-supplied prefix is attacker-controlled.
  app.set("trust proxy", 1);
  // Don't name the framework on every response.
  app.disable("x-powered-by");
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  );
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalFilters(new RiotExceptionFilter());
  // `credentials` is what lets the web tier send the session cookie: in dev it
  // sits on a different port, which is a different *origin* even though it is
  // the same site. Safe alongside the origin allowlist above — a credentialed
  // request is only honoured against an echoed origin, never a wildcard.
  app.enableCors({
    origin: resolveCorsOrigin(process.env.WEB_ORIGIN),
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 2010);
  await app.listen(port);
  console.log(`api listening on http://localhost:${port}`);
}

void bootstrap();
