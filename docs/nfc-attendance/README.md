# NFC attendance

Employees clock in and out by tapping their own phone on a wall-mounted NFC tag. There is no app and no login. A tap records attendance in the existing Workforce module, and the existing Payroll module pays from it.

Design background and every deviation from the prototype it was ported from: [RECONCILIATION.md](./RECONCILIATION.md).

## How it works

1. A **tag** on the wall holds a web address (an NDEF URL record) containing a **card id**.
2. A manager **registers each employee's phone once**. After that, tapping the tag opens that URL in the phone's browser.
3. The page identifies the employee from a cookie in that browser, records the punch, and shows the result: *Checked in at 9:02 AM*, or *Checked out, worked 8h 9m*.
4. The punch writes the same `work_sessions` rows the QR guard scanner writes, so Timesheet and Payroll need no separate path.

## Tag URL

```
https://<web origin>/app/tap?card=<card id>
```

- The web app is served under `/app/`, so the path is `/app/tap`, not `/tap`.
- The URL carries the **card id**, not the chip's hardware UID. Editing a card's label, direction or chip UID never invalidates a tag that is already written.
- **NFC cards** (sidebar) shows each card's URL with a Copy button. Write that URL onto the tag with any NFC writer app (an NDEF *URL* record).

## Cards and directions

| Direction | A tap does |
|---|---|
| **IN + OUT** (`BOTH`, recommended) | Checks in when the employee is out and checks out when they are in. One card per door. |
| **IN only** / **OUT only** | Strict. The wrong card changes nothing and tells the employee which card to use. |

A mismatched tap is recorded as a `REJECTED` audit row and shown as a normal result, not an error.

## Registering a phone

Manager (ADMIN or OPS_MANAGER):

1. **Employees** → the **Phone** column → **Manage** → **Create registration link**.
2. Send the link to the employee. It works **once** and expires after **48 hours**. A newer link replaces an unused one.

Employee, on the phone they will use:

3. Open the link **in Chrome or Safari** (not inside WhatsApp or Instagram: those keep their own cookie jar, and the tag opens the system browser). The page says *Now tap the NFC card*.
4. Tap any active NFC card within **10 minutes**. The phone is now registered; the cookie lasts about a year.

A manager can **Revoke** a lost phone from the same dialog; it stops working immediately.

## Daily rules

- **Double tap:** a second tap within 5 seconds repeats the previous result and changes nothing. A *refused* tap (the wrong card for the current state) is **not** debounced, so tapping the right card a moment later works.
- **Forgotten check-out:** a shift open 16 hours or more is closed at the 16 h cap on the next tap or payroll run (there is no background job). It is **not paid** until a manager approves it. **Live status** → *Forgotten check-outs* lets them approve it as-is or enter the real check-out time. Re-run payroll afterwards.
- **Payroll:** an auto-closed, unapproved shift is a payroll exception (`AUTO_CLOSED`); a shift still open is `NO_CHECKOUT`. Approving moves it into pay on the next run.
- **Live status** refreshes every 5 seconds and lists who is in, who is out, who has been in 16 h or more, and how many active employees have no registered phone. It shows no pay rates.

## Where things are

| Page | Who | Path |
|---|---|---|
| NFC cards | ADMIN, OPS_MANAGER | `/app/nfc-cards` |
| Live status + approvals | ADMIN, OPS_MANAGER | `/app/live-status` |
| Phone column | ADMIN, OPS_MANAGER | `/app/employees` |
| Tap, register (public) | employees' phones | `/app/tap`, `/app/register` |

Everything is behind the **WORKFORCE** module.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `APP_URL` | `http://localhost:3000` | Web origin. Registration links are `${APP_URL}/app/register?token=…`. Also the origin cookie-authenticated calls must come from. |
| `CORS_ORIGIN` | (required in prod) | Also accepted as a trusted origin for those calls. |
| `COOKIE_SECURE` | on | `false` allows the phone cookies over plain http for local LAN testing. Ignored in production. |
| `DB_POOL_MAX` | `10` | Postgres pool size. Raise to match the pooler. |
| `RATE_LIMIT_MAX` | `100` | Global per-IP requests/minute. See "Rate limits". |
| `CLIENT_IP_HEADER` | unset | Header holding the real client IP (Netlify: `x-nf-client-connection-ip`). Makes every limiter key on it. **Read "Rate limits" before setting.** |

## Security notes

**What a tap proves, and what it does not.** The card id is just a string in a URL. A tap proves *a registered phone opened this URL*, **not** that the person stood at the door. Anyone who has an enrolled phone and the URL can punch from anywhere. Keep the tag URL private, treat it like a shared key, and rely on managers reviewing the timesheet. Proposals to close this are listed in [RECONCILIATION.md](./RECONCILIATION.md) (a signed or rotating per-card token, e.g. NTAG 424 DNA).

What is protected:

- **Identity is the phone, not the request.** The employee and organization come from a hashed `DeviceSession` and the card row; nothing in the request body can choose them. A phone registered in one organization tapping another's card gets "card not recognised" and writes nothing.
- **Secrets are never stored raw.** The registration token and the device cookie are stored only as SHA-256 hashes. The raw values exist only in the link and in the cookie.
- **The "mid-registration" cookie is a fresh random secret** minted when the link is opened (its hash is stored on the token, valid 10 minutes). It is never a value taken from the database, so a database dump or backup cannot be turned into a working cookie. Opening the link in a second browser replaces the first browser's secret.
- **Probing:** a caller is identified first (device session or pending registration) and the card is then looked up *inside that caller's organization*. A missing card and another organization's card give the same answer, and a phone that is not registered learns nothing about whether a card exists. Card ids are random UUIDs.
- **Revocation is immediate even mid-flight:** the tap re-checks the phone and the employee inside the employee lock, so a tap that was already past its checks when you revoke is still refused.
- **Cookies:** `httpOnly`, `Secure`, `SameSite=Lax`. Calls that carry them also reject a foreign `Origin` header.
- **Manager actions** (cards, links, revoke, approvals, live status) require an ADMIN or OPS_MANAGER role and are scoped to that organization. Rates and QR codes never appear in live status.
- **Input:** NUL bytes are rejected everywhere (a 400, not a database 500); a malformed pending cookie is "not found".
- **Concurrency:** a per-employee advisory lock plus a database index guarantee one open shift per employee, even under a 300-phone rush.
- **Row-level security** is enabled (default-deny) on the new tables.

### Rate limits

- **Per registered phone:** 30 taps/minute, counted after the cookie is validated (a garbage cookie cannot create counters).
- **Registration links:** 200 opens/hour per address. The link token itself is 256-bit and unguessable, so this only bounds cheap lookups.
- **Global:** 100 requests/minute per address across the whole API (`RATE_LIMIT_MAX`).

**Known limitation (also true of the rest of the API before NFC): behind Netlify and Caddy the API sees the proxy's address for everyone**, so "per address" becomes one bucket shared by the whole company, and any anonymous caller who sends more than the global limit locks everyone out for a minute. The phone pages make this more visible because every tap goes through the Netlify rewrite.

To fix it properly, once and on the real deployment:

1. On staging, send a request through `https://<site>/trpc/…` and look at which headers reach the API (log them, or use a tiny echo route) to confirm Netlify's `x-nf-client-connection-ip` arrives intact.
2. Confirm the API cannot be reached by a spoofer who sets that header, or accept that it can (a caller who spoofs the header only chooses their own bucket; they can already reach the API directly).
3. Set `CLIENT_IP_HEADER=x-nf-client-connection-ip` on the API. Every limiter then keys on the real client address. **Only do this once the API origin cannot be reached around the edge, or Caddy overwrites that header**: while the API is directly reachable, a caller can send any value and choose their own bucket. The limiter's memory is bounded either way (expired keys are swept, and a hard ceiling of 50,000 keys drops the oldest), so the worst a spoofer gets is a weaker limit for themselves.
4. Until then, raise `RATE_LIMIT_MAX` (e.g. 600) so a shift start does not hit the shared bucket, and treat it as a stopgap.

I could not verify any of this from outside the deployment, which is why `CLIENT_IP_HEADER` is off by default.

## Deployment notes

- `netlify.toml` rewrites `/trpc/*` to the API so the phone pages are same-origin. **It needs a Netlify deploy**; until then the phone pages cannot reach the API with their cookie.
- The migrations are additive. Before applying to production, check (read-only) for employees with more than one open shift, which the migration will auto-close for review:
  ```sql
  SELECT "employeeId", count(*) FROM work_sessions WHERE "checkOutAt" IS NULL GROUP BY 1 HAVING count(*) > 1;
  ```
- **Approving into a frozen month is refused.** Approving a forgotten check-out adds hours to the payroll period it falls in; if that month's run is already APPROVED, PAID or CANCELLED it can never be recomputed, so the approval is refused with a clear message rather than silently never paying. An approved shift is also capped at 24 hours.
- `prisma migrate dev` will propose **dropping** the `work_sessions_one_open_per_employee` index (Prisma cannot model partial indexes). Delete that line from any generated migration.

## Physical test checklist

Needs a real tag, a manager login, and real phones. Run it on **both** an Android phone (Chrome) and an iPhone (Safari).

Setup
- [ ] Deploy `netlify.toml` and confirm `https://<site>/trpc/...` is served by the API, not the marketing page.
- [ ] Create a card (IN + OUT) under **NFC cards**; write its URL onto the tag as an NDEF URL record.
- [ ] Create an employee and a registration link.

Registration
- [ ] Open the link in WhatsApp's in-app browser: the *open in Chrome or Safari* banner appears.
- [ ] Open the link in Chrome / Safari: it says *Hi <name>, now tap the NFC card*.
- [ ] Tap the tag: *Phone registered!*. The Phone column now shows *1 phone*.
- [ ] Open the used link again: *link already used*.

Daily use
- [ ] Tap: *Checked in at <time>*. Live status lists the employee.
- [ ] Tap again within 5 s: the same message, no second check-in.
- [ ] Wait, tap again: *Checked out, worked …*.
- [ ] Close the browser completely, reopen, tap: it still works (the cookie persisted). On iPhone, also try after the phone has been locked and unlocked.
- [ ] Tap with the phone's NFC disabled / a non-NFC phone: nothing opens (expected; use the QR guard scanner).

Failure cases
- [ ] A phone that was never registered: *Phone not registered*.
- [ ] **Revoke** the phone from Employees, then tap: *Phone not allowed*.
- [ ] **Deactivate** the card, then tap: *Card not active*.
- [ ] Check in, leave it open overnight (or backdate in a test org), tap: the old shift appears under *Forgotten check-outs*; approve it; re-run payroll and confirm it is paid.
- [ ] Shift start: have 10+ people tap within seconds; watch for HTTP 429 in the browser network tab.

Rate limits (see "Rate limits" above)
- [ ] With the Netlify rewrite live, check which client-IP header reaches the API, then decide on `CLIENT_IP_HEADER` / `RATE_LIMIT_MAX`.

Things to record, because they could not be verified from here: whether the cookie survives a week on iPhone Safari through the Netlify rewrite, and what client IP the API sees.

## Known limitations

- **A tap is not proof of presence** (see above).
- **A lost response on the very first (registration) tap strands the phone:** the link is used but the phone never received its cookie. The page says "Link already used"; issue a new link. The tap page never repeats an ambiguous failure after 3 seconds, to avoid recording a second punch, so this is rare.
- **Reloading `/app/tap`, or the browser restoring a discarded tab, taps again.** The 5-second debounce absorbs a quick reload; a later one is a real second tap.
- **The Timesheet counts an unapproved auto-closed shift at its capped 16 hours** (existing behaviour of `attendance.summary`), while payroll holds it out until approved.
- **"Different check-out time" is entered in the manager's browser timezone**, while payroll buckets by the company timezone. Month-end shifts entered from another timezone can land in the neighbouring month.
- **Cookie names have no `__Host-` prefix** (a compromised sibling subdomain could set a cookie for the victim, which would make their tap clock in the wrong employee). Left out deliberately: dev over http cannot use the prefix, and the impact is limited to a wrong name on screen.
- **Retries are a heuristic, not a guarantee.** The tap page repeats a failed request only when that is very unlikely to record a second punch (a 429 before any ambiguous failure, or anything within 3 s of the first attempt) and otherwise says "couldn't confirm your tap". A server-side idempotency key (one id per page load, stored on the event) would make retries unconditionally safe and is the proposed follow-up.
- **Approving races with payroll finalization.** The approval reads the month's run status under the employee lock, but moving a run out of DRAFT (done by the payment agent) takes no such lock, so a finalize landing in the same few milliseconds could leave an approved shift unpaid. An approval made after `computeRun` while the run is still DRAFT leaves the run stale until it is recomputed (the UI says so).
- **Opening the registration link twice** (two tabs, two phones) lets the last one win; the earlier browser then sees "link not valid" and the employee just opens the link again.
- **Pay caps differ on purpose:** approving a forgotten check-out may enter real overtime up to 24 h; the older payroll "Fix checkout" action keeps its 16 h cap.
- **Netlify deploy previews** have a different origin, so cookie-authenticated calls from them fail with `BAD_ORIGIN`. Production is unaffected.

## Running the tests

```bash
pnpm test                       # everything; the database suites skip without a safe database
createdb bin_tracker_nfc_test
DATABASE_URL=postgresql://localhost:5432/bin_tracker_nfc_test DIRECT_URL=$DATABASE_URL pnpm --filter @bin-tracker/db migrate:deploy
DATABASE_URL=postgresql://localhost:5432/bin_tracker_nfc_test pnpm test
```

The `*.db.test.ts` suites run **only** against a database on localhost whose name ends in `_test` or `_ci`; anywhere else they skip, so they cannot touch real data.
