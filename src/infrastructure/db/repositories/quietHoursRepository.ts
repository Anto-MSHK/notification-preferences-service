import { Pool } from "pg";
import type { QuietHours } from "../../../domain/quietHours";
import type { QuietHoursRepository } from "../../../domain/ports/repositories";

interface QuietHoursRow {
  timezone: string;
  start_minute: number;
  end_minute: number;
}

export function createQuietHoursRepository(pool: Pool): QuietHoursRepository {
  return {
    async findByUser(userId: string): Promise<QuietHours | null> {
      const { rows } = await pool.query<QuietHoursRow>(
        `select timezone, start_minute, end_minute
           from user_quiet_hours
          where user_id = $1`,
        [userId],
      );
      const row = rows[0];
      if (!row) {
        return null;
      }
      return {
        timezone: row.timezone,
        startMinute: row.start_minute,
        endMinute: row.end_minute,
      };
    },

    async set(userId: string, quietHours: QuietHours | null): Promise<void> {
      if (quietHours === null) {
        await pool.query("delete from user_quiet_hours where user_id = $1", [userId]);
        return;
      }

      await pool.query(
        `insert into user_quiet_hours (user_id, timezone, start_minute, end_minute, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (user_id)
         do update set
           timezone = excluded.timezone,
           start_minute = excluded.start_minute,
           end_minute = excluded.end_minute,
           updated_at = now()`,
        [userId, quietHours.timezone, quietHours.startMinute, quietHours.endMinute],
      );
    },
  };
}
