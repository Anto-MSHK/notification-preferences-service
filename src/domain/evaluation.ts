import { findBlockingPolicy, type GlobalPolicy } from "./policy";
import {
  resolveSingle,
  type DefaultPreference,
  type UserPreference,
} from "./preferences";
import { isWithinQuietHours, type QuietHours } from "./quietHours";
import {
  isQuietHoursExempt,
  type Channel,
  type EvaluationResult,
  type NotificationType,
  type Region,
} from "./types";

export interface EvaluationRequest {
  notificationType: NotificationType;
  channel: Channel;
  region: Region;
  at: Date;
}

export interface EvaluationContext {
  defaults: DefaultPreference[];
  userOverrides: UserPreference[];
  quietHours: QuietHours | null;
  policies: GlobalPolicy[];
}

/**
 * Decides whether a notification may be delivered. Rules are applied in a fixed
 * order of precedence:
 *   1. global policies (compliance / platform-wide blocks)
 *   2. the user's effective preference (override, otherwise default)
 *   3. quiet hours, for types that are not exempt
 * The first rule that denies wins; otherwise the notification is allowed.
 */
export function evaluate(
  request: EvaluationRequest,
  context: EvaluationContext,
): EvaluationResult {
  const blocking = findBlockingPolicy(context.policies, {
    notificationType: request.notificationType,
    channel: request.channel,
    region: request.region,
  });
  if (blocking) {
    return { decision: "deny", reason: "blocked_by_global_policy" };
  }

  const preference = resolveSingle(
    { notificationType: request.notificationType, channel: request.channel },
    context.defaults,
    context.userOverrides,
  );

  if (!preference.enabled) {
    if (preference.source === "user") {
      return { decision: "deny", reason: "disabled_by_user" };
    }
    if (preference.source === "default") {
      return { decision: "deny", reason: "disabled_by_default" };
    }
    return { decision: "deny", reason: "not_configured" };
  }

  if (
    context.quietHours &&
    !isQuietHoursExempt(request.notificationType) &&
    isWithinQuietHours(request.at, context.quietHours)
  ) {
    return { decision: "deny", reason: "quiet_hours" };
  }

  return { decision: "allow", reason: "allowed" };
}
