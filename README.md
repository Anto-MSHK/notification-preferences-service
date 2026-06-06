# Notification Preferences Service

A small TypeScript/Node service that acts as the single source of truth for which
notification types and channels may be sent to a given user. For any
`(user, notification type, channel, region, time)` it returns an allow/deny
decision, combining four inputs: system defaults, per-user overrides, global
policies, and the user's quiet hours.

## Quick start

Requires Node 20+ and Docker.

```bash
cp .env.example .env
npm install

# Start PostgreSQL 16 on localhost:5432, database "notifications"
docker compose up -d

# The app reads DATABASE_URL. It's already in .env; export it for the CLI
# scripts (migrate/seed) if you don't load .env into your shell.
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/notifications

npm run migrate   # create tables
npm run seed      # load the default preference matrix and one example policy

npm run dev       # tsx watch on src/index.ts
# or, for a production-style run:
npm run build && npm start
```

The server listens on `PORT` (default `3000`). `LOG_LEVEL` controls pino output
(`info` by default; in dev it's pretty-printed). `DATABASE_URL` is the only
required variable, and startup fails fast if it's missing.

## Running the tests

Unit tests cover the pure domain logic and need no database:

```bash
npm run test:unit
```

Integration tests exercise the HTTP layer and repositories against a real
PostgreSQL. Point them at a throwaway database via `TEST_DATABASE_URL`:

```bash
docker compose exec db psql -U postgres -c "create database notifications_test"

TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/notifications_test \
  npm run test:integration
```

Run everything at once:

```bash
npm test
```

## API

The full machine-readable contract lives in [`docs/openapi.yaml`](docs/openapi.yaml)
(OpenAPI 3.1), which you can paste into the Swagger editor. The endpoints are
summarised below.

All bodies are JSON. Validation errors return `400` with
`{ "error": { "code", "message", "details" } }`; unexpected errors return `500`.

### Domain vocabulary

- Channels: `email`, `sms`, `push`, `messenger`
- Notification types: `transactional`, `security`, `system`, `marketing`, `promotional`
- `transactional`, `security`, and `system` are time-sensitive and bypass quiet hours.

### `GET /users/:id/preferences`

Returns the user's effective preference matrix (defaults with overrides applied)
and quiet hours. `source` is one of `default`, `user`, or `unset`.

```bash
curl http://localhost:3000/users/u123/preferences
```

```json
{
  "userId": "u123",
  "preferences": [
    { "notificationType": "transactional", "channel": "email", "enabled": true, "source": "default" },
    { "notificationType": "marketing", "channel": "email", "enabled": true, "source": "user" }
  ],
  "quietHours": { "timezone": "Europe/Berlin", "start": "22:00", "end": "08:00" }
}
```

A user is implicit: any id resolves to the defaults until it has overrides, so
there's no separate "create user" step.

### `POST /users/:id/preferences`

Upserts overrides and/or quiet hours, then returns the same shape as the GET.
Both top-level keys are optional. Quiet hours semantics:

- key omitted: quiet hours left unchanged
- key set to `null`: quiet hours cleared
- key set to an object: quiet hours replaced

```bash
curl -X POST http://localhost:3000/users/u123/preferences \
  -H 'content-type: application/json' \
  -d '{
    "preferences": [
      { "notificationType": "marketing", "channel": "email", "enabled": true }
    ],
    "quietHours": { "timezone": "Europe/Berlin", "start": "22:00", "end": "08:00" }
  }'
```

Times are `HH:mm` (24h). The timezone must be a valid IANA zone.

### `POST /evaluate`

The core decision. Given a candidate notification, returns whether it may be
sent and why.

```bash
curl -X POST http://localhost:3000/evaluate \
  -H 'content-type: application/json' \
  -d '{
    "userId": "u123",
    "notificationType": "marketing",
    "channel": "sms",
    "region": "EU",
    "datetime": "2026-06-06T21:30:00Z"
  }'
```

```json
{ "decision": "deny", "reason": "blocked_by_global_policy" }
```

`datetime` is an ISO-8601 timestamp; `region` is a free-form string (normalized
to upper-case internally).

#### Precedence and reasons

Rules are applied in a fixed order; the first one that denies wins:

1. Global policy matches: `blocked_by_global_policy`
2. User override disables it: `disabled_by_user`
3. Default preference disables it: `disabled_by_default`
   (or `not_configured` if no default exists for the pair)
4. Quiet hours, for non-exempt types: `quiet_hours`
5. Otherwise `allow` with reason `allowed`

Full set of `reason` values: `blocked_by_global_policy`, `disabled_by_user`,
`disabled_by_default`, `quiet_hours`, `not_configured`, `allowed`.

### `GET /health`

```json
{ "status": "ok" }
```

## Architecture

The code is organized in three layers with dependencies pointing inward.

**Domain** (`src/domain`) holds the typed model (channels, notification types,
preferences, policies, quiet hours) and the pure decision logic. `evaluate()` is
a pure function: it takes a request plus a fully-loaded context
(`defaults`, `userOverrides`, `quietHours`, `policies`) and returns a decision
with no IO. That keeps the rules (precedence, quiet-hours exemptions, overnight
windows) fully unit-testable without a database. Repository interfaces
("ports") also live here so the domain never depends on `pg`.

**Application** (`src/application`) orchestrates the ports. The services load the
data `evaluate()` and `resolvePreferences()` need (in parallel), call the pure
functions, and emit structured logs. They contain no business rules of their own.

**Infrastructure** (`src/infrastructure`) is the outside world: PostgreSQL
repositories implementing the domain ports, an Express HTTP layer, config
loading, and a pino logger. The HTTP layer validates input with zod, maps the
domain model to and from the wire format, and funnels all failures through a
single error-handling middleware that translates zod and domain errors into
status codes.

Notable design decisions:

- Pure core. All decision logic is a pure function over an in-memory context, so
  correctness is verified by fast unit tests; the integration tests only need to
  confirm the wiring and SQL.
- Idempotent writes through state-based upserts. Preference and quiet-hours
  writes use `INSERT ... ON CONFLICT DO UPDATE` keyed by the natural key, so
  replaying the same `POST` converges to the same state. No per-request
  idempotency keys are needed.
- Quiet hours are stored as minutes-since-midnight plus an IANA timezone and
  evaluated with luxon. Windows are interpreted in the user's local time and
  handle the overnight wrap (e.g. `22:00` to `08:00`); a zero-length window
  blocks nothing.
- Global policies use nullable wildcard fields (`notification_type`, `channel`,
  `region`). A `null` field matches anything, so one row can express a broad
  ("all marketing in the EU") or narrow ("marketing SMS in the EU") scope. The
  seed ships one example: marketing SMS blocked in the EU.
- Defaults define the full preference matrix: every `(type, channel)` pair has a
  default. A user is implicit, so any id resolves to defaults until it has
  overrides, which avoids a registration flow for what is essentially a lookup
  service.
- Validation with zod at the HTTP boundary keeps the domain free of parsing
  concerns. Two business events are logged with structure
  (`preferences.updated`, `evaluation.decided`) plus a per-request
  `request.completed` line; these are the natural attachment points for metrics
  counters and latency timers.

## What I'd add next before production

- AuthN/AuthZ. The API is currently open; it needs service-to-service auth and a
  check that callers may read or modify a given user's preferences.
- Metrics and tracing. Prometheus counters for allow/deny by `reason`, latency
  histograms per route, and request-scoped trace IDs propagated into the log
  lines that already exist.
- Audit log of preference changes (who, what, when), separate from the current
  state, for compliance and debugging.
- Caching of defaults and global policies, which change rarely and are read on
  every evaluate, with explicit invalidation.
- Pagination and filtering on `GET /users/:id/preferences` once the matrix grows.
- Admin API to manage global policies (currently only via seed/SQL).
- Write-path safety: optimistic concurrency (version or `updated_at` checks) or
  per-request idempotency keys if clients need stronger guarantees than
  state-based convergence.
- DB hardening: connection-pool sizing/tuning, statement timeouts, and running
  migrations as a gated step in CI.
- Notification-type catalog as data: replace the hardcoded enums (and the
  matching SQL `check` constraints) with a table so new types or channels don't
  require a deploy.
- Contract and load tests in addition to the current unit/integration split.
```
