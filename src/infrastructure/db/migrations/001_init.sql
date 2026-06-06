create table if not exists default_preferences (
  notification_type text not null check (notification_type in ('transactional','security','system','marketing','promotional')),
  channel text not null check (channel in ('email','sms','push','messenger')),
  enabled boolean not null,
  primary key (notification_type, channel)
);

create table if not exists user_preferences (
  user_id text not null,
  notification_type text not null check (notification_type in ('transactional','security','system','marketing','promotional')),
  channel text not null check (channel in ('email','sms','push','messenger')),
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_type, channel)
);

create table if not exists user_quiet_hours (
  user_id text primary key,
  timezone text not null,
  start_minute int not null check (start_minute between 0 and 1439),
  end_minute int not null check (end_minute between 0 and 1439),
  updated_at timestamptz not null default now()
);

create table if not exists global_policies (
  id text primary key,
  notification_type text check (notification_type in ('transactional','security','system','marketing','promotional')),
  channel text check (channel in ('email','sms','push','messenger')),
  region text,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_global_policies_region on global_policies (region);
