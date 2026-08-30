# Database migrations

`db/migrations` is the provider-neutral PostgreSQL schema. It contains no
references to Supabase `auth`, JWT helpers, storage, roles or RLS. Authentication
adapters live under `db/providers`; only the selected provider adapter is
applied after the common migrations.

User identifiers are `text` and store the verified authentication token's
`sub` claim verbatim. Provider adapters are responsible for creating the
corresponding `profiles` row before application data is written.

## One migration process

Neon and Supabase use the same command and migration ledger:

```bash
# Neon
DATABASE_URL="postgresql://..." DATABASE_PROVIDER=neon npm run db:migrate

# Supabase
DATABASE_URL="postgresql://..." DATABASE_PROVIDER=supabase npm run db:migrate
```

On PowerShell, set the same values as environment variables before running
`npm run db:migrate`. `DATABASE_URL` must be a direct PostgreSQL connection
string kept outside browser-visible `VITE_*` variables.

The runner always applies `db/migrations` first. For Supabase it then applies
`db/providers/supabase`, which owns Auth synchronization, RLS, invitation RPCs
and avatar storage policies. Neon authorization remains an application/API
responsibility. Do not use `supabase db push`; Supabase CLI is only used for
Edge Function deployment.

Applied files are recorded in `public.schema_migrations` with a SHA-256
checksum. Never edit an applied migration; add a later migration. Preview the
ordered plan without connecting:

```bash
npm run db:migrate -- --provider supabase --dry-run
```

The extracted schema is the baseline for new databases. A database created
from the former Supabase-only UUID schema needs an explicit reviewed transition
migration before this baseline is adopted; do not coerce live IDs in place.

## Homologation seeds

Seeds live only in `db/seeds/qa`, contain synthetic `example.test` identities
and are excluded from normal migrations. Both guards are required:

```bash
DATABASE_URL="postgresql://..." DATABASE_ENV=qa npm run db:seed:qa
```

The runner refuses to seed unless `DATABASE_ENV=qa`, and the SQL also checks a
transaction-local `app.environment=qa` setting. Production dumps must never be
used as seeds or copied into QA. If production-shaped troubleshooting data is
ever required, it must pass a separately reviewed anonymization process before
leaving production; anonymized exports must not be committed to this repository.
