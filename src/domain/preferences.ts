import type { Channel, NotificationType } from "./types";
import type { QuietHours } from "./quietHours";

export interface PreferenceKey {
  notificationType: NotificationType;
  channel: Channel;
}

export interface PreferenceEntry extends PreferenceKey {
  enabled: boolean;
}

export type DefaultPreference = PreferenceEntry;

export interface UserPreference extends PreferenceEntry {
  userId: string;
  updatedAt: Date;
}

export type PreferenceSource = "user" | "default" | "unset";

export interface ResolvedPreference {
  notificationType: NotificationType;
  channel: Channel;
  enabled: boolean;
  source: PreferenceSource;
}

export interface UserPreferences {
  userId: string;
  preferences: ResolvedPreference[];
  quietHours: QuietHours | null;
}

function keyOf(entry: PreferenceKey): string {
  return `${entry.notificationType}:${entry.channel}`;
}

/**
 * Merges user overrides on top of the default catalog. The defaults define the
 * full set of (type, channel) pairs a user can have; a user override replaces
 * the default for that pair.
 */
export function resolvePreferences(
  defaults: DefaultPreference[],
  userOverrides: UserPreference[],
): ResolvedPreference[] {
  const overrideMap = new Map<string, UserPreference>();
  for (const override of userOverrides) {
    overrideMap.set(keyOf(override), override);
  }

  const resolved = defaults.map<ResolvedPreference>((def) => {
    const override = overrideMap.get(keyOf(def));
    if (override) {
      overrideMap.delete(keyOf(def));
      return {
        notificationType: def.notificationType,
        channel: def.channel,
        enabled: override.enabled,
        source: "user",
      };
    }
    return {
      notificationType: def.notificationType,
      channel: def.channel,
      enabled: def.enabled,
      source: "default",
    };
  });

  for (const override of overrideMap.values()) {
    resolved.push({
      notificationType: override.notificationType,
      channel: override.channel,
      enabled: override.enabled,
      source: "user",
    });
  }

  return resolved;
}

export function resolveSingle(
  key: PreferenceKey,
  defaults: DefaultPreference[],
  userOverrides: UserPreference[],
): ResolvedPreference {
  const target = keyOf(key);

  const override = userOverrides.find((o) => keyOf(o) === target);
  if (override) {
    return { ...key, enabled: override.enabled, source: "user" };
  }

  const def = defaults.find((d) => keyOf(d) === target);
  if (def) {
    return { ...key, enabled: def.enabled, source: "default" };
  }

  return { ...key, enabled: false, source: "unset" };
}
