# IndiFrame Agent Help Centre

## Source of truth

This GitHub repository is the sole source of truth for the application. Continue from the existing codebase; do not rebuild the product from scratch.

### Existing modules
- Command Centre overview
- Full inbound and outbound script libraries embedded in `public/app.js`
- Objection Lab, FAQ Knowledge Bank, Product Quick Reference and Weekly Knowledge Quiz
- Manager Studio and Agent KPI dashboard
- Daily Performance Leaderboard
- AI Call Simulation
- Automated Coaching Centre

### Access-control baseline
- The authorised Manager email is `mahesh.s@hrhnext.com`.
- Other registered users are assigned the Agent role.
- Manager-only team and KPI write operations are checked by API handlers.
- Inactive accounts are blocked by the protected API handlers.
- Keep role checks on the server; hiding Manager UI elements is not sufficient security.

## Runtime architecture

**Provider configuration and deployment are pending.**

- Source control: GitHub
- Frontend hosting and Node.js serverless APIs: Vercel
- Authentication and PostgreSQL: Supabase Auth + Supabase Database
- AI: OpenAI Responses API called only from the server
- CI: GitHub Actions

All application source, SQL migrations, deployment workflows and configuration templates must be committed to this repository. No external visual app builder or alternate source platform is part of the runtime architecture.

## Migration implementation status

The `supabase-schema-foundation` branch contains:
- Supabase Auth browser wrapper using email OTP; passkey sign-in is not included in this first migration.
- Server-side JWT verification and Manager/Agent allowlist enforcement in `api/_lib/supabase.js`.
- Supabase-compatible `/api/me`, `/api/kpi`, `/api/team` and `/api/insights` endpoints.
- Server-side AI simulation using the OpenAI Responses API. The API key and model are read from server environment variables.
- Supabase schema + RLS migration at `supabase/migrations/202611160001_initial_schema.sql`.
- Vercel configuration, environment-variable template, GitHub Actions syntax workflow and JavaScript syntax-check script.
- Browser API calls attach the Supabase access token.

## Remaining blockers and acceptance tests

1. Create/select a dedicated Supabase project and set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
2. Review and apply the Supabase migration only to the intended new project; configure Supabase email OTP delivery and the email template to display the one-time code.
3. Set `OPENAI_API_KEY` and `OPENAI_MODEL` in Vercel. The selected model must support the Responses API and JSON output.
4. Confirm Vercel project settings, deployment and production domain. No deployment has been performed from this branch.
5. Run Manager, Agent, inactive-account, team scope, KPI write, quiz, leaderboard, AI turn/evaluation and full script-library acceptance tests.

## Required Vercel environment variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)
- `OPENAI_API_KEY` (server-only secret)
- `OPENAI_MODEL`

Use `.env.example` as a variable-name reference only. Never commit real values.

## Important operating rules

- Do not change customer data or invent approved pricing, warranty, delivery, serviceability or technical commitments.
- Do not weaken protected-account restrictions or Manager authorization.
- Never commit API keys, database passwords, service-role keys or AI provider secrets.
- Preserve the complete approved script library, including all language variants; do not replace full scripts with summaries or truncated previews.

## Supabase schema foundation (prepared, not applied)

A first Supabase migration is available at `supabase/migrations/202611160001_initial_schema.sql`.

It defines UUID-based references to Supabase Auth, the existing profile/KPI/quiz/simulation data model, an allowlisted Manager profile trigger, and Row Level Security policies. Agent users can read their own records; Manager access is restricted to the active `mahesh.s@hrhnext.com` account. KPI writes are Manager-only, quiz submissions are self-scoped, and simulation evaluations are read-only to browser clients so only a trusted server-side function can save them.

**Status:** SQL file committed to the `supabase-schema-foundation` branch for review. It has not been run against a Supabase project. Do not connect production or migrate live data until the SQL is reviewed, a dedicated Supabase project is selected, and the API conversion and acceptance tests are ready.

## GitHub-driven Vercel deployment

A production deployment workflow is prepared at `.github/workflows/deploy-vercel.yml`. It runs only after a push to `main` or a manual workflow dispatch; it does not deploy this feature branch automatically.

Before using it, add these GitHub Actions repository secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Also configure the five application environment variables listed above in the Vercel project's Production environment. The Supabase migration still requires a deliberate manual review and application to the correct Supabase project. No deployment or database migration has been run.
