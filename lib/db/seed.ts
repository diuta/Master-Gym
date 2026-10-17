import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const DEV_PASSWORD = "password123";
const DEV_EMAIL = "admin@mastergym.test";

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  await db.insert(schema.users).values({
    name: "Admin",
    email: DEV_EMAIL,
    password: passwordHash,
  });

  console.log("Seed done. Account:", DEV_EMAIL, "password:", DEV_PASSWORD);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
