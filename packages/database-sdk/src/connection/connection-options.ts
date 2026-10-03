export interface DriverConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly ssl?: boolean;
  readonly timeout?: number;
  /**
   * Opt-in, Postgres-only third layer of read-only enforcement (alongside
   * `ReadOnlyAdapter` and a database-level read-only user — see
   * docs/ATLAS-RUNTIME-CLIENT.md's "Database access requirements"): every
   * connection the pool opens starts with `default_transaction_read_only
   * = on` as a startup parameter, so even a write that somehow reached
   * `execute()` would be rejected by Postgres itself. Defaults to `false`
   * (unset) for every other `PostgresDriver` consumer in this repo — this
   * is not a safe default for connections that need to write.
   */
  readonly readOnlySession?: boolean;
}

export interface ConnectionOptions extends DriverConfig {
  readonly poolSize?: number;
  readonly schema?: string;
  readonly appName?: string;
}
