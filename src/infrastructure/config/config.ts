export interface Config {
  port: number;
  logLevel: string;
  databaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required but was not set");
  }

  const port = parsePort(env.PORT);

  return {
    port,
    logLevel: env.LOG_LEVEL ?? "info",
    databaseUrl,
  };
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return 3000;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT "${value}", expected an integer in [0, 65535]`);
  }
  return port;
}
