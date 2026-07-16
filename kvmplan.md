# Hostinger KVM4 VPS Setup — Bin Tracker Production Runbook

> **Companion to `SAAS.md`.** This file covers the infrastructure the SaaS application code runs on. `SAAS.md` Phase 5 assumes everything in this file is already provisioned.

**What this box runs:** the bin-tracker API (blue/green, zero-downtime deploys) + Hermes and future AI agents, in isolated Docker stacks, behind Caddy (TLS) and Cloudflare (DNS/DDoS). Supabase remains the database; Netlify remains the frontend host — neither is affected by anything in this file.

## 0. Architecture

```
Internet
   │
   ▼
Cloudflare (DNS + proxy + DDoS, free tier)
   │  (orange-clouded: api.<domain>)
   ▼
Hostinger KVM4 — public IP, UFW allows only Cloudflare IP ranges on 80/443
   │
   ▼
Caddy (only process bound to 80/443, auto-TLS via Let's Encrypt, "Full (strict)" to Cloudflare)
   │
   ├──► bintracker-api stack (Docker network: api_net)
   │      ├── api_blue   (Fastify/tRPC, port 3001 internal)
   │      ├── api_green  (Fastify/tRPC, port 3002 internal — idle until a deploy promotes it)
   │      └── worker      (BullMQ background jobs, added in SAAS.md Phase 5 Task 20)
   │      → talks OUT to Supabase (DATABASE_URL, pooler :6543)
   │
   └──► agents stack (Docker network: agents_net — NOT connected to api_net)
          ├── hermes
          ├── redis (shared agent queue/state)
          └── (future agents, one container each)

Tailscale — private overlay network for SSH, Netdata, and any agent dashboards.
Nothing agent-related is reachable from the public internet.
```

**The isolation guarantee:** `api_net` and `agents_net` are separate Docker networks with no bridge between them. An agent container cannot open a socket to the API container — the only path between them is the same public HTTPS endpoint any external client would use. Combined with per-container `mem_limit`/`cpus`, a misbehaving agent cannot degrade the customer-facing API.

## 1. Prerequisites

- A domain you control, with the ability to change nameservers (for Cloudflare) or at least add DNS records.
- SSH key pair generated locally (`ssh-keygen -t ed25519`).
- A Cloudflare account (free tier is sufficient).
- A Tailscale account (free tier covers this).

## 2. Cloudflare setup (free tier)

1. **Add the site to Cloudflare** → it scans existing DNS records → follow its instructions to change your domain's nameservers to Cloudflare's (at your registrar). Propagation is usually under an hour.
2. **DNS records:**
   | Type | Name | Content | Proxy status |
   |---|---|---|---|
   | A | `api` | `<VPS public IP>` | **Proxied** (orange cloud) — this is the one that matters; a bare VPS has zero DDoS protection on its own, Cloudflare's free tier absorbs volumetric/L3/L4 attacks before they ever reach Hostinger. |
   | CNAME | `app` | `<your-netlify-site>.netlify.app` | **DNS only** (grey cloud) — let Netlify's own CDN/edge handle this directly; proxying Netlify through Cloudflare adds a second SSL-termination layer that commonly causes redirect-loop issues if not configured with matching SSL modes. Not worth the complexity for a Netlify-hosted app. |
   | CNAME | `@` (apex, marketing) | `<your-netlify-marketing-site>.netlify.app` | **DNS only** — same reasoning. |
3. **SSL/TLS mode:** set to **Full (strict)** under SSL/TLS → Overview. This requires Caddy's origin certificate to be valid (it is — Caddy auto-provisions real Let's Encrypt certs, see §6), giving encrypted edge-to-origin instead of the unencrypted-origin risk of "Flexible" mode. **Never use Flexible** — it leaves Cloudflare-to-VPS traffic in plaintext.
4. **Firewall rule (free tier includes 5 rules):** create one rule blocking any request where the country/ASN pattern looks like known bad actors is optional; the higher-value free-tier win is simpler — see §3 for restricting the VPS firewall to Cloudflare's IPs only, which is the real security boundary.
5. **Rate limiting (free tier includes 1 rule):** apply to `/trpc/*` — e.g. block an IP doing >300 requests/minute to that path. This sits above Fastify's own per-IP rate limit (`@fastify/rate-limit`, 100/min, already in `apps/api/src/server.ts`) as a second layer that blocks traffic before it even reaches the VPS.
6. **Analytics:** Cloudflare's free dashboard shows traffic + threats blocked — a free, zero-setup monitoring signal in addition to what's in §11.

## 3. Server hardening (one-time, ~30 minutes)

Run as root on first login, then never again as root:

```bash
# Create a non-root deploy user
adduser deploy
usermod -aG sudo deploy

# SSH key-only auth
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/   # your local pubkey
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys

# Harden sshd
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd

# Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
systemctl enable docker    # boot persistence — see §7

# Firewall — restrict 80/443 to Cloudflare's IP ranges only, SSH via Tailscale only
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do ufw allow from $ip to any port 80,443 proto tcp; done
for ip in $(curl -s https://www.cloudflare.com/ips-v6); do ufw allow from $ip to any port 80,443 proto tcp; done
ufw enable

# fail2ban for SSH brute force (Tailscale-only SSH still benefits from this as defense-in-depth)
apt install -y fail2ban

# Automatic security patches
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Tailscale — private access to SSH, Netdata, agent internals
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
```

**Important:** re-run the Cloudflare IP `ufw allow` loop periodically (Cloudflare occasionally updates its ranges) — put this in the monthly maintenance checklist (§13).

## 4. Directory layout

```
/opt/
├── bintracker-api/
│   ├── docker-compose.yml
│   ├── .env                    # chmod 600 — DATABASE_URL, DIRECT_URL, JWT secrets, Stripe keys
│   └── deploy.sh
├── agents/
│   ├── docker-compose.yml
│   ├── .env.hermes             # chmod 600 — Hermes's own Claude API key
│   └── .env.<future-agent>     # one file per agent — a leaked key exposes only that agent
├── caddy/
│   ├── Caddyfile
│   └── upstream.txt            # deploy.sh writes "api_blue" or "api_green" here
└── monitoring/
    └── docker-compose.yml      # Netdata
```

## 5. `docker-compose.yml` — bintracker-api stack

```yaml
# /opt/bintracker-api/docker-compose.yml
services:
  api_blue:
    image: bintracker-api:latest
    container_name: api_blue
    restart: unless-stopped
    env_file: .env
    networks: [api_net]
    ports: ["3001:3001"]
    mem_limit: 2g
    cpus: 1.5
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    logging:
      driver: json-file
      options: { max-size: "50m", max-file: "3" }

  api_green:
    image: bintracker-api:latest
    container_name: api_green
    restart: "no"          # only started explicitly by deploy.sh during a deploy
    env_file: .env
    networks: [api_net]
    ports: ["3002:3001"]
    mem_limit: 2g
    cpus: 1.5
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    logging:
      driver: json-file
      options: { max-size: "50m", max-file: "3" }

networks:
  api_net:
    name: api_net
```

Combined API budget: 2 containers × (2 GB / 1.5 vCPU) but only one is ever live under normal operation — the idle color only runs briefly during a deploy, so steady-state usage is ~2 GB / 1.5 vCPU out of the box's 16 GB / 4 vCPU.

## 6. Caddyfile

```
# /opt/caddy/Caddyfile
api.<your-domain> {
    reverse_proxy {
        to localhost:3001 localhost:3002
        lb_policy first
        health_uri /health
        health_interval 10s
    }
}
```

Simpler alternative used by `deploy.sh` (§8): rather than Caddy load-balancing across both, `deploy.sh` rewrites this file's `to` line to point at only the live color and runs `caddy reload` — this is more explicit and avoids any chance of traffic hitting the idle/booting color mid-deploy. Run Caddy itself as a container too:

```yaml
# /opt/caddy/docker-compose.yml
services:
  caddy:
    image: caddy:2-alpine
    container_name: caddy
    restart: unless-stopped
    network_mode: host       # needs to reach api_blue/api_green on localhost ports
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```

## 7. Boot persistence & crash recovery

Two settings, already applied above, are what satisfy "auto start" and "crash recovery" with zero manual steps:

1. `systemctl enable docker` (§3) — the Docker daemon itself starts on every boot.
2. `restart: unless-stopped` on every container — Docker restarts a crashed container automatically within seconds, and brings the whole stack back up the moment the daemon starts after a reboot.

No systemd unit for the app itself is needed — Docker's own restart policy plus the daemon starting on boot is sufficient and is the standard pattern.

## 8. `deploy.sh` — zero-downtime blue-green deploy

```bash
#!/usr/bin/env bash
# /opt/bintracker-api/deploy.sh
set -euo pipefail

CURRENT=$(cat /opt/caddy/upstream.txt 2>/dev/null || echo "api_blue")
if [ "$CURRENT" = "api_blue" ]; then
  IDLE="api_green"; IDLE_PORT=3002
else
  IDLE="api_blue"; IDLE_PORT=3001
fi

echo "Live: $CURRENT — deploying to idle: $IDLE"

docker compose -f /opt/bintracker-api/docker-compose.yml build "$IDLE"
docker compose -f /opt/bintracker-api/docker-compose.yml up -d "$IDLE"

echo "Waiting for $IDLE health check..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${IDLE_PORT}/health" > /dev/null; then
    echo "$IDLE is healthy."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "FAILED: $IDLE did not become healthy in 30s. Aborting, $CURRENT stays live."
    exit 1
  fi
  sleep 1
done

# Flip Caddy to the newly-healthy color
sed -i "s/to localhost:[0-9]*/to localhost:${IDLE_PORT}/" /opt/caddy/Caddyfile
echo "$IDLE" > /opt/caddy/upstream.txt
docker exec caddy caddy reload --config /etc/caddy/Caddyfile

echo "Traffic flipped to $IDLE. Stopping $CURRENT."
docker compose -f /opt/bintracker-api/docker-compose.yml stop "$CURRENT"

echo "Deploy complete. Live: $IDLE"
```

`chmod +x deploy.sh`. This is what SAAS.md's rollback step (Task 10) refers to — reverting is `docker compose start $CURRENT` + flipping the Caddyfile back, no rebuild needed as long as the old color's container wasn't removed.

## 9. `docker-compose.yml` — agents stack

```yaml
# /opt/agents/docker-compose.yml
services:
  hermes:
    image: <hermes-image-or-build>
    container_name: hermes
    restart: unless-stopped
    env_file: .env.hermes
    networks: [agents_net]
    mem_limit: 4g
    cpus: 2
    logging:
      driver: json-file
      options: { max-size: "50m", max-file: "3" }

  redis:
    image: redis:7-alpine
    container_name: agents_redis
    restart: unless-stopped
    networks: [agents_net]
    mem_limit: 512m
    volumes: [agents_redis_data:/data]

networks:
  agents_net:
    name: agents_net    # deliberately NOT the same network as api_net

volumes:
  agents_redis_data:
```

Add one service block per future agent, each with its own `mem_limit`/`cpus` and its own `env_file: .env.<agent>`. Budget check: API reserves ~2 GB/1.5 vCPU, leaving ~13 GB/2.5 vCPU for agents + Redis + Caddy + Netdata — comfortable headroom for Hermes plus several more agents calling the Claude API (lightweight, since they're not running local inference).

## 10. CI/CD

```yaml
# .github/workflows/deploy-vps.yml
name: Deploy to VPS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production   # same gated-approval Environment used by the existing Render workflow
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: deploy
          key: ${{ secrets.VPS_DEPLOY_SSH_KEY }}
          script: |
            cd /opt/bintracker-api
            git pull origin main
            ./deploy.sh
```

`VPS_DEPLOY_SSH_KEY` is a dedicated deploy-only key pair (not your personal key) added to `deploy`'s `authorized_keys` on the box and stored as a GitHub Secret. The `environment: production` gate means this still requires the same required-reviewer approval the current Render deploy workflow uses (per `deployment-guide.md`) — self-hosting doesn't relax that safety check.

## 11. Secrets management

- One `.env` per concern: `/opt/bintracker-api/.env` (DB, JWT, Stripe), `/opt/agents/.env.hermes`, `/opt/agents/.env.<agent>` — never a single shared file.
- `chmod 600`, owned by `deploy`, never committed (already covered by `.gitignore`).
- If any file's permissions or the box itself is ever suspected compromised: rotate every secret in that file immediately (Supabase keys, Stripe keys, JWT signing secret, the specific agent's Claude API key).

## 12. Monitoring

| Tool | Watches | Access |
|---|---|---|
| Sentry (`@sentry/node`, `@sentry/react`) | Exceptions, API + agents, tagged `orgId` | Web dashboard |
| BetterStack uptime | `https://api.<domain>/health` every ~30s from outside | Web dashboard, email/Slack alerts |
| BetterStack heartbeat | One per agent — agent pings each loop iteration; silence = alert | Web dashboard |
| Netdata | Live CPU/RAM/disk on the box — this is where you watch for agent-vs-API resource contention | **Tailscale only**, never public |
| Cloudflare analytics | Traffic + threats blocked at the edge | Cloudflare dashboard |

Netdata as a container:
```yaml
# /opt/monitoring/docker-compose.yml
services:
  netdata:
    image: netdata/netdata:latest
    container_name: netdata
    restart: unless-stopped
    network_mode: host        # binds to the Tailscale interface too
    pid: host
    cap_add: [SYS_PTRACE]
    security_opt: ["apparmor:unconfined"]
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
```
Access at `http://<tailscale-ip>:19999` — never expose port 19999 through UFW.

## 13. Backup strategy

No database lives on this box — Supabase owns that, with PITR backups on the Pro plan. The only irreplaceable state here is config and secrets:

- **Config** (`docker-compose.yml`, `Caddyfile`, `deploy.sh`, this file): lives in git. Losing the box = re-clone + re-run §3.
- **Secrets** (`.env*` files): back these up encrypted — e.g. `age`-encrypt each file and push to a private location (password manager, private repo separate from application code). Recovery goal: "re-provision from git + restore secrets," never "lose data," since there is no data on this box to lose.

## 14. Maintenance cadence

- **Weekly:** `docker system prune -f` (clears old images from blue-green swaps); glance at Netdata for resource creep.
- **Monthly:** confirm `unattended-upgrades` applied patches (`/var/log/unattended-upgrades/`); confirm Caddy's cert auto-renewed (`docker logs caddy | grep -i certificate`); re-run the Cloudflare IP allowlist loop from §3 in case ranges changed; do one backup-restore drill (decrypt a `.env` backup, confirm it's valid).

## 15. Verification checklist

- [ ] `curl https://api.<domain>/health` → `200 {"status":"ok",...}`.
- [ ] `docker compose -f /opt/bintracker-api/docker-compose.yml ps` → live color shows `Up (healthy)`.
- [ ] `docker compose -f /opt/agents/docker-compose.yml ps` → all agents `Up`.
- [ ] Reboot the VPS (`sudo reboot`) → within ~60s, `curl https://api.<domain>/health` succeeds again with zero manual steps.
- [ ] `docker kill api_blue` (while it's live) → Docker restarts it automatically within seconds; confirm with `docker compose ps` and a follow-up `curl`.
- [ ] Push a trivial commit to `main`, approve the deploy gate → confirm via a `while true; do curl -s -o /dev/null -w "%{http_code}\n" https://api.<domain>/health; sleep 0.2; done` loop that no request returns non-200 during the deploy.
- [ ] Spike CPU/memory inside the `hermes` container deliberately (e.g. a tight loop) → confirm via Netdata that `api_blue`/`api_green`'s reserved resources are unaffected and `/health` stays green.
- [ ] From an external machine, `nmap -p- <VPS-IP>` (or Hostinger's own scan) → only ports reachable are those Cloudflare needs (80/443 from Cloudflare IPs only — a direct scan from a non-Cloudflare IP should show them filtered/closed since UFW only allows Cloudflare's ranges).
- [ ] Confirm SSH only works via Tailscale + key auth — a direct public-IP SSH attempt from a non-Tailscale source should fail/timeout.
