// Loads apps/api/.env before any test module runs — needed since Sprint
// 46.19: Control Plane Tenant/Organization tests need a real DATABASE_URL
// (Postgres-backed, no in-memory fallback anymore), the same way `pnpm dev`
// already gets it via index.ts's `import 'dotenv/config'`. Test files never
// import index.ts, so without this, DATABASE_URL (and friends) would only
// be present if the shell running vitest happened to already have them
// exported.
import 'dotenv/config';
