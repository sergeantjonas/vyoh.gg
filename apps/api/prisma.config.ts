import "dotenv/config";
import { defineConfig } from "prisma/config";

// `exactOptionalPropertyTypes` rejects an explicit `url: undefined`, so an
// unset DATABASE_URL leaves the key out and the CLI reports it missing itself.
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: url === undefined ? {} : { url },
});
