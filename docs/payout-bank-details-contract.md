# Employee bank details — contract with the payroll payout agent

bin-tracker owns the `employees` table. The payout agent has **read-only** access to it and
reads the bank columns in `loadDestination()`.

This document is the interface between the two repos. **Read section 4 before deploying
anything** — the ordering matters more than the code.

---

## 1. Columns

Added by `packages/db/prisma/migrations/20260721120000_employee_bank_details`.

| Column | Contents |
|---|---|
| `bankInstitution` | **encrypted** — 3 digits |
| `bankTransit` | **encrypted** — 5 digits |
| `bankAccount` | **encrypted** — 7–12 digits |
| `accountHolderName` | **encrypted** — name as printed on the account |
| `accountType` | plaintext `CHEQUING` \| `SAVINGS` |
| `bankAccountLast4` | plaintext, display mask only |
| `bankDetailsAt` | timestamp of submission, `NULL` until the employee submits |
| `email` | plaintext (pre-existing column) |
| `bankLinkToken`, `bankLinkExpiresAt` | bin-tracker internal — the self-serve link. Ignore. |

All nullable. An employee exists before they submit banking; treat missing or unreadable
details as `HELD`, never as a partial payment.

**`bankDetailsAt IS NOT NULL` is the reliable "this employee is payable" check.** It is set in
the same write as the encrypted fields.

## 2. Ciphertext format

```
v1.<iv>.<tag>.<ciphertext>
```

- Four `.`-separated parts. `v1` is a literal version prefix.
- Parts 2–4 are **base64url** (no padding).
- Algorithm: **AES-256-GCM**, 12-byte random IV per value, 16-byte auth tag.
- Key: `BANK_DETAILS_KEY`, 64 lowercase hex characters (32 bytes), shared by both repos.

Written by `apps/api/src/lib/bank-crypto.ts`. If you change that file, change this document.

Generate the key once, then set it in both environments:

```bash
openssl rand -hex 32
```

## 3. Reference decrypt (Node, for the payout repo)

```js
import { createDecipheriv } from 'node:crypto';

const KEY = Buffer.from(process.env.BANK_DETAILS_KEY, 'hex'); // 32 bytes

export function decryptBankField(stored) {
  const parts = stored.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Bank field is not in the expected encrypted format');
  }
  const [, iv, tag, ciphertext] = parts;
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
```

A failed auth tag means the value is wrong-key or tampered. **Hold the payout — never send a
partially trusted account number to Zum Rails.**

## 4. Rollout order — do not skip step 2

The payout agent expects plaintext digits. If it reads `v1.…` and does not validate the digit
format, it could register a Zum payee with garbage bank data — a money-movement bug, and worse
than `HELD`.

Sequencing removes the risk entirely, because **no bank data exists until an admin sends the
first link**:

| Step | State | What the payout agent sees |
|---|---|---|
| 1. bin-tracker ships this change | columns exist, every value `NULL` | nothing — identical to today, everyone `HELD` |
| 2. Share `BANK_DETAILS_KEY`; payout agent implements + deploys decrypt | still all `NULL` | still nothing |
| 3. Admins start sending bank-details requests | employees submit | decrypts fine, employees get paid |

Between steps 1 and 3 the feature is dark and nothing can regress. Confirm step 2 is deployed
before telling anyone to send links.

## 5. `zum_payees`

Already present in the shared Supabase project (verified: 3 columns, 0 rows) — the payroll side
applied `002_zum_payees.sql`. bin-tracker now declares a matching `ZumPayee` model purely so
Prisma stops reporting it as drift; **bin-tracker never reads or writes it.** Its migration uses
`CREATE TABLE IF NOT EXISTS`, so `prisma migrate deploy` is a no-op against the shared DB and
still produces a correct fresh dev/CI database.

## 6. Security rules bin-tracker holds up on its side

- **Encrypted at rest.** Only ciphertext is ever written to those four columns.
- **Never returned by the API.** A global `omit` in `packages/db/src/client.ts` strips them from
  every Prisma read, including nested `include`s. `apps/api/src/services/employee-bank-leak.test.ts`
  fails the *typecheck* if that omit is removed.
- **Never logged.** Errors on these paths are replaced with generic messages, and
  `apps/api/src/lib/sentry.ts` disables request body/header/cookie capture.
- **Admins never see them.** Employees submit through their own single-use emailed link; the
  dashboard shows `****1234` from `bankAccountLast4` and nothing more.
- **Link tokens hashed at rest** (SHA-256, `apps/api/src/lib/token.ts`), cleared on use, 7-day
  expiry. A DB dump yields no working links.

If the payout agent ever needs to log a destination for debugging, log `bankAccountLast4` and
`employeeId` — never a decrypted field.
