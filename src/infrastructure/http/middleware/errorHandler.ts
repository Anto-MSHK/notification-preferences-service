import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { NotFoundError, ValidationError, DomainError } from "../../../domain/errors";
import type { Logger } from "../../../domain/ports/logger";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      send(res, 400, { error: { code: "validation_error", message: "Invalid request", details: err.flatten() } });
      return;
    }

    if (err instanceof ValidationError) {
      send(res, 400, { error: { code: err.code, message: err.message, details: err.details } });
      return;
    }

    if (err instanceof NotFoundError) {
      send(res, 404, { error: { code: err.code, message: err.message } });
      return;
    }

    if (err instanceof DomainError) {
      send(res, 400, { error: { code: err.code, message: err.message } });
      return;
    }

    logger.error({ err: serializeError(err) }, "request.failed");
    send(res, 500, { error: { code: "internal_error", message: "Internal server error" } });
  };
}

function send(res: Parameters<ErrorRequestHandler>[2], status: number, body: ErrorBody): void {
  res.status(status).json(body);
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: String(err) };
}
