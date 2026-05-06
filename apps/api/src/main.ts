import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:2009",
  });
  const port = Number(process.env.PORT ?? 2010);
  await app.listen(port);
  console.log(`api listening on http://localhost:${port}`);
}

void bootstrap();
