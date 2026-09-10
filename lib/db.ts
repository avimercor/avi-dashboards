import { Pool } from "pg";

declare global {
  var __pgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    global.__pgPool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return global.__pgPool;
}
