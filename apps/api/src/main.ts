import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { requireEnv, resolveCorsOrigin } from "./env";
import { HttpLoggingInterceptor } from "./http-logging.interceptor";
import { RiotExceptionFilter } from "./riot/riot.exception-filter";

async function bootstrap() {
  requireEnv("DATABASE_URL");
  requireEnv("RIOT_API_KEY");
  // Only in production: unset, `resolveCorsOrigin` falls back to any localhost
  // port, which is right for dev and wrong for a public deploy.
  if (process.env.NODE_ENV === "production") requireEnv("WEB_ORIGIN");

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  );
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalFilters(new RiotExceptionFilter());
  app.enableCors({ origin: resolveCorsOrigin(process.env.WEB_ORIGIN) });
  const port = Number(process.env.PORT ?? 2010);
  await app.listen(port);
  console.log(`api listening on http://localhost:${port}`);
}

void bootstrap();
