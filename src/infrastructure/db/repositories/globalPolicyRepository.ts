import type { Pool } from "pg";
import type { GlobalPolicy } from "../../../domain/policy";
import type { GlobalPolicyRepository } from "../../../domain/ports/repositories";
import {
  toRegion,
  type Channel,
  type NotificationType,
  type Region,
} from "../../../domain/types";

interface GlobalPolicyRow {
  id: string;
  notification_type: string | null;
  channel: string | null;
  region: string | null;
  reason: string;
}

function mapRow(row: GlobalPolicyRow): GlobalPolicy {
  return {
    id: row.id,
    notificationType: row.notification_type as NotificationType | null,
    channel: row.channel as Channel | null,
    region: row.region === null ? null : toRegion(row.region),
    reason: row.reason,
  };
}

export function createGlobalPolicyRepository(pool: Pool): GlobalPolicyRepository {
  return {
    async list(): Promise<GlobalPolicy[]> {
      const { rows } = await pool.query<GlobalPolicyRow>(
        "select id, notification_type, channel, region, reason from global_policies",
      );
      return rows.map(mapRow);
    },

    async findMatching(
      notificationType: NotificationType,
      channel: Channel,
      region: Region,
    ): Promise<GlobalPolicy[]> {
      const normalizedRegion = toRegion(region);
      const { rows } = await pool.query<GlobalPolicyRow>(
        `select id, notification_type, channel, region, reason
           from global_policies
          where (notification_type is null or notification_type = $1)
            and (channel is null or channel = $2)
            and (region is null or region = $3)`,
        [notificationType, channel, normalizedRegion],
      );
      return rows.map(mapRow);
    },
  };
}
