# IndiFrame Agent Help Centre

## Current source baseline

The existing application is preserved in this repository. Continue from the current source; do not rebuild the product from scratch.

### Existing modules
- Command Centre overview
- Full inbound and outbound script libraries currently embedded in `public/app.js`
- Objection Lab, FAQ Knowledge Bank, Product Quick Reference and Weekly Knowledge Quiz
- Manager Studio and Agent KPI dashboard
- Daily Performance Leaderboard
- AI Call Simulation
- Automated Coaching Centre

### Current access-control baseline
- The authorised Manager email is `mahesh.s@hrhnext.com`.
- Other registered users are assigned the Agent role.
- Manager-only team and KPI write operations are checked by API handlers.
- Inactive accounts are blocked by the protected API handlers.
- Keep role checks on the server; hiding Manager UI elements is not sufficient security.

## GitHub runtime migration

**Source control:** GitHub only. All application source, SQL migrations, deployment workflows and configuration templates must be committed here. Do not make further changes or deployments through Hatchable.

**Target runtime architecture (pending provider connection):**
- Frontend hosting: Vercel
- Authentication and PostgreSQL: Supabase Auth + Supabase Database
- Backend: Supabase Edge Functions (or a separately hosted API in this repository)
- AI: server-side provider integration; secrets must never be exposed in browser code
- CI/CD: GitHub Actions

### Migration blockers identified in the current code
1. `api/me.js`, `api/kpi.js`, `api/team.js`, `api/insights.js` and `api/simulate.js` import the Hatchable runtime/database/AI SDK.
2. `public/login.html` calls `window.hatchable.auth` for OTP and passkey authentication.
3. `public/app.js` checks `window.hatchable.auth.getSession()` during application startup.
4. `hatchable.toml` contains Hatchable-specific auth, AI and database access configuration.
5. The repository currently has no root `package.json`, Vercel configuration or GitHub Actions workflow.

These dependencies must be replaced before the existing app can run independently of Hatchable. Do not implement custom password storage. Use managed authentication (Supabase Auth) and enforce authorization in server-side functions and database RLS policies.

## Migration sequence

- [ ] Preserve current application as the baseline; do not remove existing modules or approved script content.
- [ ] Replace Hatchable auth with Supabase Auth (email/password or approved managed sign-in flow).
- [ ] Recreate the profile, KPI, quiz and simulation data model in Supabase with migrations and Row Level Security.
- [ ] Reimplement API handlers with verified Supabase JWTs and server-side Manager/Agent authorization.
- [ ] Move AI simulation to a server-side function and retain its current policy guardrails and scoring rubric.
- [ ] Verify full script content, copy controls, search/filter behaviour and Roman Hindi/Roman Telugu script additions.
- [ ] Add Vercel build/deployment configuration and GitHub Actions checks.
- [ ] Test Manager, Agent, inactive-account, data-scope and AI flows before switching production traffic.

## Important operating rules

- Do not change customer data or invent approved pricing, warranty, delivery, serviceability or technical commitments.
- Do not weaken protected-account restrictions or Manager authorization.
- Keep the existing Hatchable deployment untouched until the replacement has passed acceptance testing.
- Never commit API keys, database passwords, service-role keys or AI provider secrets.
