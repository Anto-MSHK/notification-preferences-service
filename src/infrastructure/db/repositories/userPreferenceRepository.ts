import { Pool } from "pg";
import type { UserPreference } from "../../../domain/preferences";
import type {
  PreferenceUpsert,
  UserPreferenceRepository,
} from "../../../domain/ports/repositories";
import type { Channel, NotificationType } from "../../../domain/types";

interface UserPreferenceRow {
  user_id: string;
  notification_type: string;
  channel: string;
  enabled: boolean;
  updated_at: Date;
}

function mapRow(row: UserPreferenceRow): UserPreference {
  return {
    userId: row.user_id,
    notificationType: row.notification_type as NotificationType,
    channel: row.channel as Channel,
    enabled: row.enabled,
    updatedAt: row.updated_at,
  };
}

export function createUserPreferenceRepository(pool: Pool): UserPreferenceRepository {
  async function listByUser(userId: string): Promise<UserPreference[]> {
    const { rows } = await pool.query<UserPreferenceRow>(
      `select user_id, notification_type, channel, enabled, updated_at
         from user_preferences
        where user_id = $1`,
      [userId],
    );
    return rows.map(mapRow);
  }

  return {
    listByUser,

    async upsertMany(userId: string, changes: PreferenceUpsert[]): Promise<UserPreference[]> {
      if (changes.length === 0) {
        return listByUser(userId);
      }

      const client = await pool.connect();
      try {
        await client.query("begin");
        for (const change of changes) {
          await client.query(
            `insert into user_preferences (user_id, notification_type, channel, enabled, updated_at)
             values ($1, $2, $3, $4, now())
             on conflict (user_id, notification_type, channel)
             do update set enabled = excluded.enabled, updated_at = now()`,
            [userId, change.notificationType, change.channel, change.enabled],
          );
        }
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      } finally {
        client.release();
      }

      return listByUser(userId);
    },
  };
}
