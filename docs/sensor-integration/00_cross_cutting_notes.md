# Cross-Cutting Notes — Sensor Integration

These don't belong to any single action item but affect the workstream as a whole.

## 1. The architecture reversal needs one written line
The requirements/design-basis doc originally mandated a standalone Python/FastAPI service with its own database and zero dependency on `apps/api`. These 9 action items build the feature entirely inside `apps/api` with Prisma and tRPC instead — the right call, but nothing currently marks the original section as superseded. Add one line to that doc: *"Superseded — see Action Items 1–9; built inside `apps/api`, not as a standalone service."* Otherwise the next person who reads the original requirements doc first will start building the standalone service that was explicitly abandoned.

## 2. Live ingestion (post-demo) isn't tracked anywhere yet
The demo's data pipeline is a manually-started, `nohup`-supervised terminal process (Action Item 3) — not `pm2`, which this repo doesn't use anywhere; the closest production analog is the existing `worker` service in `infra/vps/bintracker-api/docker-compose.yml`. There is no numbered action item yet for the eventual production version — a scheduled worker job with proper token-refresh infrastructure, replacing the demo script. Until that's created as its own tracked item, the demo pipeline has no stated successor and risks quietly becoming "temporary" permanent infrastructure.

## 3. Two open questions block real thresholds and real device behavior
Neither is resolved by any of the 9 items, and both are why `thresholdStatus` was removed from storage (Action Item 1) rather than computed once and cached:
- Real threshold values (temp/humidity/ammonia safe ranges) — still placeholders; sanity-checked against backfilled data per Action Item 3's step on this, but not vendor-confirmed real numbers.
- ~~The cause of same-timestamp reading clusters~~ — confirmed on the Aug 5 vendor call: caused by initial Wi-Fi setup/handling, not normal steady-state behavior. See Action Item 1 for the corrected reasoning. The schema decision (no unique constraint) stands for an unrelated, still-relevant reason: confirmed backlog-catchup bursts after any offline period.

## 4. Data retention and device-reassignment semantics are still undecided
If a device is ever reassigned from one organization to another, do its historical readings follow it, or stay with the original org? This is a data-leak decision, not a data-hygiene detail, and must be made explicit before any device-reassignment flow is built — not defaulted implicitly by whatever the schema happens to allow.

## 5. Corrected build order (Item 3 no longer blocks on Item 4)
Item 3 was originally ordered after Item 4 for a reason that no longer applies (it never computes threshold status — that dependency was removed in this version). Item 3 only depends on Item 1, and can run in parallel with Item 4. This matters: Item 3 is the long pole for the demo — it needs to be running and populated with real data well before the walkthrough — so don't gate it behind work it doesn't actually need.

```
main
 └── feature/sensor-integration
      ├── 1  schema
      ├── 2  module key        (ADD VALUE alone; label = 'Environment')
      ├── 7  recharts          (+ Suspense boundary — parallel)
      ├── 3  backfill/poll     (after 1 only — parallel to 4)
      ├── 4  service           (after 1)
      ├── 5  router            (after 4; returns companyTimezone)
      ├── 6  registration      (after 5)
      ├── 8  dashboard         (after 5 + 7; UNKNOWN → idle tone)
      └── 9  nav + route       (after 8; Suspense-wrapped)
```
