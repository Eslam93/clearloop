// Connection settings.
//
// Production sets DATABASE_URL (the clearloop_app role, through the pooler) and, for migrations
// only, DATABASE_URL_OWNER. Local development and tests fall back to the embedded Postgres that
// `pnpm dev` starts, so the project runs with no setup and no keys.

export const LOCAL = {
  port: 54329,
  database: "clearloop",
  ownerUser: "postgres",
  ownerPassword: "postgres",
  appUser: "clearloop_app",
  appPassword: "clearloop_app_local",
} as const;

const isProduction = () => process.env.NODE_ENV === "production" && !process.env.CLEARLOOP_LOCAL;

export function appDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (isProduction()) throw new Error("DATABASE_URL is not set");
  return `postgres://${LOCAL.appUser}:${LOCAL.appPassword}@localhost:${LOCAL.port}/${LOCAL.database}`;
}

export function ownerDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_OWNER;
  if (url) return url;
  if (isProduction()) throw new Error("DATABASE_URL_OWNER is not set");
  return `postgres://${LOCAL.ownerUser}:${LOCAL.ownerPassword}@localhost:${LOCAL.port}/${LOCAL.database}`;
}
