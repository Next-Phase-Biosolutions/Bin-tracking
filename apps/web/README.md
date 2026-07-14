# Next Phase BioSolutions — Facility OS (app)

The operator-facing application that sits behind the marketing site's login. It reimagines the
demo at `trackingbin.netlify.app/app/facility` in the premium Next Phase brand UI, with every
feature carried over (see [`INVENTORY.md`](./INVENTORY.md)).

## Stack
- Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion
- Mock auth + mock data now; structured for a real backend later.

## Run
```bash
npm install
npm run dev        # http://localhost:3000  (any email/password signs in)
npm run build && npm run start
```

## Screens
- **Login** (`/login`) — mock auth (any credentials).
- **Facility Dashboard** (`/dashboard`) — the **unified** dashboard (the demo's Main Dashboard
  **and** Ops Dashboard merged): workflow progress, ops metrics (active bins, overdue, done
  today, compliance), zone status grid, recovery cycles + "Post on Blockchain", live activity,
  environmental panel.
- **Zones** (`/zones/{receiving,killfloor,processing,wetaging,valueadd,shipping}`) — stats,
  active lists, zone actions, live environment.
- **Forms** (`/forms`, `/forms/[id]`, `/forms/import`) — list, multi-section/checklist fill flow
  with voice-fill + blockchain seal, and "Create from Photo".
- **Employee Scanner** (`/employee-scanner`) — renamed from the demo's "Guard Scanner"; badge
  check in/out.
- **Animal Registration** (`/animal-registration`) — voice-fills the form + opens a lifecycle passport.
- **Employee Registration** (`/employees/register`) — generates a QR badge.
- **Shipments** (`/shipments`, `/shipments/new`) · **Timesheet** (`/timesheet`) ·
  **Bin Scanner** (`/bin-scanner`).
- **Driver Portal** (`/driver`) — standalone, no sidebar; scan a bin, log pickup/delivery.
- Persistent **Butcher Talk** voice assistant (floating mic) + Floor / Butcher Talk / Back Office
  mode switch in the top bar.

## Where the real backend plugs in
All screens read through **`lib/api.ts`** (which currently returns the in-memory mock data in
`lib/data.ts`). Replace the function bodies in `lib/api.ts` with real `fetch()` / database calls
and **no UI changes are needed**. Auth lives in **`lib/auth.tsx`** — swap `login()`/`logout()`/the
session read for real authentication (e.g. Supabase) and the rest of the app is unchanged.

## Deploy (Netlify)
This is a normal (non-static) Next.js app, so it uses Netlify's Next.js runtime (auto-detected).
It is served at **`nextphasebiosolutions.com/app`**: this app is built with `basePath: "/app"`
(see `next.config.mjs`) and runs on its own Netlify site (`nextphase-app.netlify.app`, base
directory `nextphase-app`); the **marketing** site proxies `/app/*` to it via `site/netlify.toml`.
No subdomain or extra DNS is needed.

The login hand-off is driven by `NEXT_PUBLIC_APP_URL=/app` on the **marketing** site, so its
`/login` portal redirects to `nextphasebiosolutions.com/app/?u=<email>` and this app auto-enters.

```bash
npm run build
netlify deploy --prod   # or connect the GitHub repo to the app site for auto-deploys
```
