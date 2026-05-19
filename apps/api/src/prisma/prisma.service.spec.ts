import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  it("forwards onModuleInit to $connect", async () => {
    const service = new PrismaService();
    const connect = vi
      .spyOn(service, "$connect")
      .mockResolvedValue(undefined as unknown as never);
    const disconnect = vi
      .spyOn(service, "$disconnect")
      .mockResolvedValue(undefined as unknown as never);
    await service.onModuleInit();
    expect(connect).toHaveBeenCalledOnce();
    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
