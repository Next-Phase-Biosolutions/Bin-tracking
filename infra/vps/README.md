# VPS deploy config

Generated from `kvmplan.md` — that file is the full runbook (server hardening,
Cloudflare, Tailscale, monitoring, verification checklist). This directory is
just the config that runs on the box.

**Layout:** this directory lives inside the same repo checkout the VPS clones
to `/opt/bin-tracker` (per §3/§10 of `kvmplan.md`). Nothing here works from a
partial copy — the `bintracker-api` compose file's build context reaches back
to the repo root for the pnpm workspace.

| Dir | What it runs | `.env` file to create (never commit) |
|---|---|---|
| `bintracker-api/` | blue/green API containers (`deploy.sh` flips between them) | `bintracker-api/.env` — copy from `.env.example` |
| `caddy/` | reverse proxy + auto-TLS, only process bound to 80/443 | none |
| `agents/` | Hermes + future agents, isolated network from the API | `agents/.env.hermes` — copy from `.env.hermes.example` |
| `monitoring/` | Netdata, Tailscale-only | none |

First deploy on the box: `docker compose -f caddy/docker-compose.yml up -d`,
`docker compose -f bintracker-api/docker-compose.yml up -d api_blue`,
`docker compose -f agents/docker-compose.yml up -d`,
`docker compose -f monitoring/docker-compose.yml up -d`. After that,
`.github/workflows/deploy-vps.yml` drives `bintracker-api/deploy.sh` on every
push to `main`.
