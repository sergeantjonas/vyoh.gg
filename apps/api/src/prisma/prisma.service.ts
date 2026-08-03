import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        // One pool serves every controller *and* every cron poller, so a
        // handful of slow queries can starve the sync tick as easily as a page
        // load. `pg` defaults to 10; 20 is sized for a single small VPS where
        // Postgres shares the box with the api and web tiers, so a much larger
        // pool would trade api queueing for database contention.
        max: 20,
        // Nothing here caps how long a query may run: Postgres defaults
        // `statement_timeout` to 0, meaning never. A query that hangs holds its
        // connection until it finishes, and the pool is the shared resource, so
        // one pathological query becomes everyone's problem. Ten seconds is far
        // above any query this app issues — the heaviest analytics window is
        // measured in tens of milliseconds — and well below the point at which
        // a caller has given up anyway.
        statement_timeout: 10_000,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
