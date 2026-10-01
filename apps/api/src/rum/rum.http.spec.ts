import { gzipSync } from "node:zlib";
import { Global, type INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FallbackExceptionFilter } from "../fallback-exception.filter";
import { PrismaService } from "../prisma/prisma.service";
import { RumModule } from "./rum.module";

// Over real HTTP rather than against the controller, because the part that can
// silently break is the module's middleware: a beacon arrives as `text/plain`,
// which the global body parsers ignore, so without it every beacon would reach
// the DTO as an empty body.
const prisma = {
  $transaction: vi.fn(async (ops: unknown[]) => ops),
  webVitalSample: { upsert: vi.fn((args: unknown) => args) },
};

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: prisma }],
  exports: [PrismaService],
})
class FakePrismaModule {}

const BEACON = {
  route: "/",
  formFactor: "desktop",
  navigationType: "navigate",
  samples: [
    {
      id: "v6-1790861459105-4815162342108",
      name: "LCP",
      value: 2560,
      rating: "needs-improvement",
    },
  ],
};

describe("POST /rum", () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakePrismaModule, RumModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
    );
    // main.ts's catch-all, so a parser failure is judged the way production
    // judges it: anything it does not recognise becomes a reported 500.
    app.useGlobalFilters(new FallbackExceptionFilter());
    await app.listen(0, "127.0.0.1");
    url = `${await app.getUrl()}/rum`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prisma.webVitalSample.upsert.mockClear();
  });

  const post = (
    body: string | Uint8Array,
    type = "text/plain;charset=UTF-8",
    headers: Record<string, string> = {}
  ) =>
    fetch(url, { method: "POST", headers: { "content-type": type, ...headers }, body });

  it("accepts a beacon posted as text/plain, the way sendBeacon sends a string", async () => {
    const res = await post(JSON.stringify(BEACON));
    expect(res.status).toBe(204);
    expect(prisma.webVitalSample.upsert).toHaveBeenCalledTimes(1);
  });

  it("still accepts a beacon sent as application/json", async () => {
    const res = await post(JSON.stringify(BEACON), "application/json");
    expect(res.status).toBe(204);
    expect(prisma.webVitalSample.upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects text that is not JSON", async () => {
    expect((await post("not json")).status).toBe(400);
    expect(prisma.webVitalSample.upsert).not.toHaveBeenCalled();
  });

  it("rejects a parsed beacon the DTO refuses", async () => {
    const res = await post(JSON.stringify({ ...BEACON, route: "/lol/vyoh?q=1" }));
    expect(res.status).toBe(400);
    expect(prisma.webVitalSample.upsert).not.toHaveBeenCalled();
  });

  it("refuses a body past the limit before parsing it", async () => {
    const res = await post(JSON.stringify({ ...BEACON, pad: "x".repeat(5000) }));
    expect(res.status).toBe(413);
    expect(prisma.webVitalSample.upsert).not.toHaveBeenCalled();
  });

  it("answers a gzip body that inflates past the limit with 413, not 500", async () => {
    // A few hundred bytes on the wire, so under nginx's cap, and far over the
    // api's once inflated.
    const bomb = gzipSync(JSON.stringify({ ...BEACON, pad: "x".repeat(20_000) }));
    const res = await post(bomb, undefined, { "content-encoding": "gzip" });
    expect(res.status).toBe(413);
  });

  it("answers an unsupported charset with 415, not 500", async () => {
    const res = await post(JSON.stringify(BEACON), "text/plain;charset=bogus");
    expect(res.status).toBe(415);
  });
});
