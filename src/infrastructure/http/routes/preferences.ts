import { Router, type Request, type Response, type NextFunction, type RequestHandler } from "express";

import type { PreferencesService, UpdatePreferencesInput } from "../../../application/preferencesService";
import type { UserPreferences } from "../../../domain/preferences";
import {
  quietHoursInputToDomain,
  quietHoursToApi,
  updatePreferencesSchema,
} from "../schemas";

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

function renderPreferences(prefs: UserPreferences): unknown {
  return {
    userId: prefs.userId,
    preferences: prefs.preferences.map((p) => ({
      notificationType: p.notificationType,
      channel: p.channel,
      enabled: p.enabled,
      source: p.source,
    })),
    quietHours: quietHoursToApi(prefs.quietHours),
  };
}

export function createPreferencesRouter(preferencesService: PreferencesService): Router {
  const router = Router();

  router.get(
    "/users/:id/preferences",
    asyncHandler(async (req, res) => {
      const userId = req.params.id ?? "";
      const prefs = await preferencesService.getPreferences(userId);
      res.status(200).json(renderPreferences(prefs));
    }),
  );

  router.post(
    "/users/:id/preferences",
    asyncHandler(async (req, res) => {
      const body = updatePreferencesSchema.parse(req.body);

      const input: UpdatePreferencesInput = {};
      if (body.preferences) {
        input.preferences = body.preferences;
      }
      // Distinguish an absent key (leave unchanged) from an explicit null (clear).
      if ("quietHours" in (req.body as Record<string, unknown>)) {
        input.quietHours = body.quietHours ? quietHoursInputToDomain(body.quietHours) : null;
      }

      const userId = req.params.id ?? "";
      const updated = await preferencesService.updatePreferences(userId, input);
      res.status(200).json(renderPreferences(updated));
    }),
  );

  return router;
}
