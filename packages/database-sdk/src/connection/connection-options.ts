export interface DriverConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly ssl?: boolean;
  readonly timeout?: number;
}

export interface ConnectionOptions extends DriverConfig {
  readonly poolSize?: number;
  readonly schema?: string;
  readonly appName?: string;
}
