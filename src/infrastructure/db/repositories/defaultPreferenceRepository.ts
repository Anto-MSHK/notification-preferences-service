import type { Pool } from "pg";
import type { DefaultPreference } from "../../../domain/preferences";
import type { DefaultPreferenceRepository } from "../../../domain/ports/repositories";
import type { Channel, NotificationType } from "../../../domain/types";

interface DefaultPreferenceRow {
  notification_type: string;
  channel: string;
  enabled: boolean;
}

export function createDefaultPreferenceRepository(pool: Pool): DefaultPreferenceRepository {
  return {
    async list(): Promise<DefaultPreference[]> {
      const { rows } = await pool.query<DefaultPreferenceRow>(
        "select notification_type, channel, enabled from default_preferences",
      );
      return rows.map((row) => ({
        notificationType: row.notification_type as NotificationType,
        channel: row.channel as Channel,
        enabled: row.enabled,
      }));
    },
  };
}
