import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { requireEnv } from "./env";
import { HttpLoggingInterceptor } from "./http-logging.interceptor";
import { RiotExceptionFilter } from "./riot/riot.exception-filter";

async function bootstrap() {
  requireEnv("DATABASE_URL");
  requireEnv("RIOT_API_KEY");

  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalFilters(new RiotExceptionFilter());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? /^http:\/\/localhost:\d+$/,
  });
  const port = Number(process.env.PORT ?? 2010);
  await app.listen(port);
  console.log(`api listening on http://localhost:${port}`);
}

void bootstrap();
