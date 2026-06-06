import { Router, type Request, type Response, type NextFunction, type RequestHandler } from "express";

import type { EvaluationService } from "../../../application/evaluationService";
import { toRegion } from "../../../domain/types";
import { evaluateSchema } from "../schemas";

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export function createEvaluateRouter(evaluationService: EvaluationService): Router {
  const router = Router();

  router.post(
    "/evaluate",
    asyncHandler(async (req, res) => {
      const body = evaluateSchema.parse(req.body);

      const result = await evaluationService.evaluate({
        userId: body.userId,
        notificationType: body.notificationType,
        channel: body.channel,
        region: toRegion(body.region),
        at: body.datetime,
      });

      res.status(200).json({ decision: result.decision, reason: result.reason });
    }),
  );

  return router;
}
