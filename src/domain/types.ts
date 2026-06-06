export const CHANNELS = ["email", "sms", "push", "messenger"] as const;
export type Channel = (typeof CHANNELS)[number];

export const NOTIFICATION_TYPES = [
  "transactional",
  "security",
  "system",
  "marketing",
  "promotional",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Types that are allowed to bypass quiet hours. Transactional and security
 * messages are time-sensitive, so a user's quiet window does not suppress them.
 */
const QUIET_HOURS_EXEMPT: ReadonlySet<NotificationType> = new Set([
  "transactional",
  "security",
  "system",
]);

export function isQuietHoursExempt(type: NotificationType): boolean {
  return QUIET_HOURS_EXEMPT.has(type);
}

export type Region = string & { readonly __brand: "Region" };

export function toRegion(value: string): Region {
  return value.trim().toUpperCase() as Region;
}

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value);
}

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export type Decision = "allow" | "deny";

export type DecisionReason =
  | "allowed"
  | "blocked_by_global_policy"
  | "disabled_by_user"
  | "disabled_by_default"
  | "quiet_hours"
  | "not_configured";

export interface EvaluationResult {
  decision: Decision;
  reason: DecisionReason;
}
