import { Pool } from "pg";

interface DefaultRow {
  notificationType: string;
  channel: string;
  enabled: boolean;
}

const DEFAULT_PREFERENCES: DefaultRow[] = [
  { notificationType: "transactional", channel: "email", enabled: true },
  { notificationType: "transactional", channel: "sms", enabled: true },
  { notificationType: "transactional", channel: "push", enabled: true },
  { notificationType: "transactional", channel: "messenger", enabled: true },

  { notificationType: "security", channel: "email", enabled: true },
  { notificationType: "security", channel: "sms", enabled: true },
  { notificationType: "security", channel: "push", enabled: true },
  { notificationType: "security", channel: "messenger", enabled: false },

  { notificationType: "system", channel: "email", enabled: true },
  { notificationType: "system", channel: "sms", enabled: false },
  { notificationType: "system", channel: "push", enabled: true },
  { notificationType: "system", channel: "messenger", enabled: false },

  { notificationType: "marketing", channel: "email", enabled: false },
  { notificationType: "marketing", channel: "sms", enabled: false },
  { notificationType: "marketing", channel: "push", enabled: false },
  { notificationType: "marketing", channel: "messenger", enabled: false },

  { notificationType: "promotional", channel: "email", enabled: false },
  { notificationType: "promotional", channel: "sms", enabled: false },
  { notificationType: "promotional", channel: "push", enabled: false },
  { notificationType: "promotional", channel: "messenger", enabled: false },
];

export async function seed(pool: Pool): Promise<void> {
  for (const pref of DEFAULT_PREFERENCES) {
    await pool.query(
      `insert into default_preferences (notification_type, channel, enabled)
       values ($1, $2, $3)
       on conflict (notification_type, channel)
       do update set enabled = excluded.enabled`,
      [pref.notificationType, pref.channel, pref.enabled],
    );
  }

  await pool.query(
    `insert into global_policies (id, notification_type, channel, region, reason)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do nothing`,
    ["pol_eu_marketing_sms", "marketing", "sms", "EU", "eu_marketing_sms_restriction"],
  );

  console.log(
    `seeded ${DEFAULT_PREFERENCES.length} default preferences and 1 global policy`,
  );
}

if (require.main === module) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  seed(pool)
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      return pool.end().finally(() => process.exit(1));
    });
}
