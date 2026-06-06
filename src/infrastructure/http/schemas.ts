import { z } from "zod";

import {
  CHANNELS,
  NOTIFICATION_TYPES,
  type Channel,
  type NotificationType,
} from "../../domain/types";
import {
  isValidTimezone,
  minutesToTime,
  parseTimeToMinutes,
  type QuietHours,
} from "../../domain/quietHours";

// z.enum needs a mutable tuple; the domain exposes readonly const arrays.
export const channelSchema = z.enum([...CHANNELS] as [Channel, ...Channel[]]);
export const notificationTypeSchema = z.enum(
  [...NOTIFICATION_TYPES] as [NotificationType, ...NotificationType[]],
);

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "expected time in HH:mm format");

export const quietHoursInputSchema = z.object({
  timezone: z.string().refine(isValidTimezone, { message: "invalid timezone" }),
  start: timeSchema,
  end: timeSchema,
});

export type QuietHoursInput = z.infer<typeof quietHoursInputSchema>;

export const preferenceUpsertSchema = z.object({
  notificationType: notificationTypeSchema,
  channel: channelSchema,
  enabled: z.boolean(),
});

export const updatePreferencesSchema = z.object({
  preferences: z.array(preferenceUpsertSchema).optional(),
  quietHours: quietHoursInputSchema.nullable().optional(),
});

export type UpdatePreferencesBody = z.infer<typeof updatePreferencesSchema>;

export const evaluateSchema = z.object({
  userId: z.string().min(1),
  notificationType: notificationTypeSchema,
  channel: channelSchema,
  region: z.string().min(1),
  datetime: z.string().datetime().pipe(z.coerce.date()),
});

export type EvaluateBody = z.infer<typeof evaluateSchema>;

export function quietHoursInputToDomain(input: QuietHoursInput): QuietHours {
  return {
    timezone: input.timezone,
    startMinute: parseTimeToMinutes(input.start),
    endMinute: parseTimeToMinutes(input.end),
  };
}

export interface QuietHoursApi {
  timezone: string;
  start: string;
  end: string;
}

export function quietHoursToApi(quietHours: QuietHours | null): QuietHoursApi | null {
  if (!quietHours) {
    return null;
  }
  return {
    timezone: quietHours.timezone,
    start: minutesToTime(quietHours.startMinute),
    end: minutesToTime(quietHours.endMinute),
  };
}
