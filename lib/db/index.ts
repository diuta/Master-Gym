import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const needsSsl = process.env.DATABASE_URL.includes("sslmode=require");
const connectionString = process.env.DATABASE_URL.replace(
  /[?&]sslmode=require/,
  "",
);

const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
