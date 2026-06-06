import { loadConfig } from "./infrastructure/config/config";
import { createLogger } from "./infrastructure/logging/logger";
import { createPool, closePool } from "./infrastructure/db/pool";
import { createUnitOfWork } from "./infrastructure/db/unitOfWork";
import { createServer } from "./infrastructure/http/server";

function main(): void {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const pool = createPool(config.databaseUrl);
  const uow = createUnitOfWork(pool);
  const app = createServer({ uow, logger });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "service.started");
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "service.shutting_down");
    server.close(() => {
      void closePool(pool).finally(() => process.exit(0));
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
