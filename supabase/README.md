# Supabase setup

The browser only receives the public project URL and publishable key. Never add
`SUPABASE_SERVICE_ROLE_KEY` or another administrative secret to `.env` values
prefixed with `VITE_`.

## Local and hosted environments

1. Create separate Supabase projects for QA/Preview and Production.
2. Copy the public URL and publishable key into the corresponding Vercel
   Preview and Production environment variables.
3. Apply the common schema and Supabase adapter through the repository's single
   PostgreSQL migration runner:

   ```bash
   DATABASE_PROVIDER=supabase DATABASE_URL="postgresql://..." npm run db:migrate
   ```

4. Deploy the provider-specific Edge Functions with the Supabase CLI:

   ```bash
   npx supabase functions deploy invite-member
   npx supabase functions deploy accept-invitation
   ```

5. Configure the Auth site URL, redirect URLs, Google provider and SMTP in each
   Supabase project. The invitation and password-reset flows use the app's
   `/invite/accept`, `/auth/callback` and `/settings` paths.

The local preview remains available when the public variables are empty. It
does not migrate browser data into Supabase automatically.

The portable tables and constraints live in `db/migrations`. Supabase Auth,
RLS, invitation RPCs and Storage policies live in `db/providers/supabase`.
See `db/README.md` for migration ordering, Neon usage and QA seed safeguards.
