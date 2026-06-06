import express, { type Express } from "express";

import { createEvaluationService } from "../../application/evaluationService";
import { createPreferencesService } from "../../application/preferencesService";
import type { Logger } from "../../domain/ports/logger";
import type { UnitOfWork } from "../../domain/ports/repositories";
import { createErrorHandler } from "./middleware/errorHandler";
import { createEvaluateRouter } from "./routes/evaluate";
import { createPreferencesRouter } from "./routes/preferences";

export interface ServerDeps {
  uow: UnitOfWork;
  logger: Logger;
}

export function createServer(deps: ServerDeps): Express {
  const { uow, logger } = deps;

  const app = express();
  app.use(express.json());

  // Log each request once it has finished, with the resolved status code.
  app.use((req, res, next) => {
    res.on("finish", () => {
      logger.info(
        { method: req.method, path: req.originalUrl, status: res.statusCode },
        "request.completed",
      );
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  const preferencesService = createPreferencesService(uow, logger);
  const evaluationService = createEvaluationService(uow, logger);

  app.use(createPreferencesRouter(preferencesService));
  app.use(createEvaluateRouter(evaluationService));

  app.use(createErrorHandler(logger));

  return app;
}
