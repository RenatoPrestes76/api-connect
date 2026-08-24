-- Postgres 15+ changed the default: the `public` schema is owned by
-- pg_database_owner and no longer grants CREATE to the database owner role
-- automatically. Without this, `prisma migrate`/`db push` fails with
-- "P1010: User `seltriva` was denied access on the database ... .public"
-- on a freshly created container, even though POSTGRES_USER=seltriva is the
-- database's own owner. Runs once, automatically, on first container init
-- (docker-entrypoint-initdb.d convention) — see docker-compose.yml's
-- postgres.volumes mount.
GRANT ALL ON SCHEMA public TO seltriva;
