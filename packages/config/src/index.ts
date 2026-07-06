/**
 * @seltriva/config
 * Environment and configuration management
 */

interface Config {
  env: string;
  database: {
    url: string;
  };
  api: {
    port: number;
    secretKey: string;
    logLevel: string;
  };
  cloud: {
    port: number;
  };
}

function validateEnv(): void {
  const required = [
    'DATABASE_URL',
    'API_SECRET_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

export function getConfig(): Config {
  validateEnv();

  return {
    env: process.env.NODE_ENV || 'development',
    database: {
      url: process.env.DATABASE_URL!,
    },
    api: {
      port: parseInt(process.env.API_PORT || '3001', 10),
      secretKey: process.env.API_SECRET_KEY!,
      logLevel: process.env.LOG_LEVEL || 'info',
    },
    cloud: {
      port: parseInt(process.env.CLOUD_PORT || '3000', 10),
    },
  };
}

export type { Config };
