import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

function parseArgs() {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

const VALID_ROLES = schema.roleEnum.enumValues;

async function main() {
  const { name, email, password, role } = parseArgs();

  if (!name || !email || !password || !role) {
    console.error(
      `Required: --name --email --password --role (${VALID_ROLES.join("|")})`,
    );
    process.exit(1);
  }

  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    console.error(`--role must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  const passwordHash = await bcrypt.hash(password, 10);

  const [created] = await db
    .insert(schema.users)
    .values({
      name,
      email,
      password: passwordHash,
      role: role as (typeof VALID_ROLES)[number],
    })
    .returning({ id: schema.users.id, email: schema.users.email });

  console.log("User created:", created);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
