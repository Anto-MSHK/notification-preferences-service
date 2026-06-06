import pino, { type Logger as PinoLogger, type LoggerOptions } from "pino";

import type { Logger } from "../../domain/ports/logger";

function wrap(pinoLogger: PinoLogger): Logger {
  return {
    info(payload, message) {
      pinoLogger.info(payload, message);
    },
    warn(payload, message) {
      pinoLogger.warn(payload, message);
    },
    error(payload, message) {
      pinoLogger.error(payload, message);
    },
    child(bindings) {
      return wrap(pinoLogger.child(bindings));
    },
  };
}

export function createLogger(level: string): Logger {
  const options: LoggerOptions = { level };

  // In development we prefer human-readable output. pino-pretty is a dev
  // dependency, so fall back to plain JSON logging if it cannot be loaded.
  if (process.env.NODE_ENV !== "production" && hasPinoPretty()) {
    options.transport = {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    };
  }

  return wrap(pino(options));
}

function hasPinoPretty(): boolean {
  try {
    require.resolve("pino-pretty");
    return true;
  } catch {
    return false;
  }
}
