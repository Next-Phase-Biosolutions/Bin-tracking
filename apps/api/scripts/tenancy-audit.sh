#!/usr/bin/env bash
# Tenancy audit — catches a new prisma.<tenant-model>.<method>(...) call site
# added to apps/api/src/services/ without an inline organizationId filter.
#
# Every hit below was manually reviewed (see .superpowers/sdd/task-8d-report.md)
# and is a false positive of the underlying grep, which only checks for the
# literal text "organizationId" on the SAME source line as the "prisma."
# call — real Prisma calls routinely put `where: { organizationId: orgId }`
# a line or two below the call itself. Each hit here falls into one of:
#
#   [FILTER]   the call's `where` is built from a filter variable/spread
#              (e.g. `cycleFilter`, `facilityFilter`, `where`) that always
#              includes organizationId in every branch — verified by reading
#              the function, not just grepping it.
#   [COMPOUND] a lookup by an `organizationId_<field>` compound unique key
#              (e.g. qrCode, masterQrCode, period) — cannot resolve another
#              org's row by construction.
#   [POSTCHECK] a fetch-by-id immediately followed by an explicit
#              `row.organizationId !== orgId` check that throws NOT_FOUND
#              before the row is used or returned.
#   [CREATE]   a `.create()` call — organizationId is being written into
#              `data`, not used to scope a read, so it isn't a leak vector.
#   [VERIFIED-ID] a lookup by an id that was already verified against
#              organizationId earlier in the same call chain.
#   [TOKEN]    a lookup or mutation gated by a single-use, hashed credential
#              token (e.g. bankLinkToken) rather than a caller-supplied
#              organizationId. These are PUBLIC/unauthenticated endpoints by
#              design — there is no caller org to check against, because the
#              token itself is the sole credential. The org is derived from
#              whichever row the token resolves to, never asserted by the
#              caller, so there is no cross-org substitution vector: an
#              attacker with someone else's token gets that person's data,
#              not a choice of org. Same trust model as invitation.service.ts's
#              token-based accept flow, which this script doesn't audit
#              because `invitation` isn't in the tracked model list below —
#              `employee` is, so these need an explicit entry instead.
#
# HOW THIS FAILS ON A REGRESSION: if a new prisma.<model>.<method>( call is
# added anywhere in apps/api/src/services/ without organizationId on that
# same line, its (file, line-content) pair either won't be in ALLOWLIST at
# all, or will push that pair's occurrence COUNT past what ALLOWLIST lists
# for it — either way the script exits 1. Editing an *existing* allowlisted
# line's content also drops it out of the allowlist (forcing
# re-justification) unless the edit is only to add organizationId to that
# same line, in which case the grep stops matching it entirely.
#
# COUNTING, NOT SET MEMBERSHIP: several files legitimately contain
# byte-identical repeated lines (e.g. dashboard.service.ts has the literal
# line "prisma.binCycle.count({" at four call sites, all org-scoped via a
# `cycleFilter` spread a few lines below). A plain set-diff (sort -u +
# comm -23) would collapse those four hits into one string, so ONE
# allowlist entry would silently cover a THIRD-PARTY, brand-new, genuinely
# unscoped call added later with the same line text — the audit would pass
# with zero new entries. To close that hole, CURRENT keeps one line per
# actual grep hit (no dedup) and ALLOWLIST lists a legitimately-repeated
# line exactly as many times as it legitimately occurs. The comparison
# below is a per-key occurrence count: a key fails only when CURRENT's
# count for it exceeds ALLOWLIST's count for it, which is exactly "there
# are more of this exact line than we've reviewed."
#
# Known limitation: this is a textual tripwire, not a semantic checker. It
# cannot see a regression introduced by changing a shared filter variable's
# definition without touching any of the call sites below. That class of bug
# is caught by tenancy-isolation.test.ts and per-service tests instead.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.."

SERVICES_DIR="apps/api/src/services"

RAW_HITS=$(grep -rn "prisma\.\(facility\|binType\|bin\|binCycle\|employee\|shipment\|formTemplate\|animalRegistration\|settings\|payrollRun\)\." "$SERVICES_DIR" | grep -v organizationId || true)

# NOTE: sort (not sort -u) — duplicates are kept so occurrence counts are
# preserved. See "COUNTING, NOT SET MEMBERSHIP" above.
CURRENT=$(echo "$RAW_HITS" | sed -E 's/^([^:]+):[0-9]+:[[:space:]]*/\1\t/' | sort)

# Written to a temp file (rather than a command-substituted heredoc) because
# bash 3.2 — the default /bin/bash on macOS — mishandles a heredoc nested
# inside $(...).
#
# Lines that legitimately occur more than once in the codebase with
# byte-identical (file, content) text are listed here that many times —
# the count of an entry here IS the reviewed-safe occurrence count, not
# just a membership flag. See "COUNTING, NOT SET MEMBERSHIP" above. As of
# this writing the repeated entries are:
#   dashboard.service.ts  prisma.binCycle.count({                    x4
#   dashboard.service.ts  prisma.binCycle.findMany({                 x2
#   dashboard.service.ts  prisma.binCycle.count({ where }),          x2
#   cycle.service.ts      prisma.binCycle.findMany({                 x2
#   bin.service.ts        const binType = await prisma.binType.findUnique({  x2
#   bin.service.ts        const activeBins = await prisma.bin.findMany({     x2
#
# Animal Records dashboard (farmer.service.ts) entries:
#   [FILTER] return prisma.animalRegistration.findMany({ — `where` object is
#            built inline directly below the call with organizationId: orgId
#            unconditionally present; only the search OR-block is conditional.
#   [FILTER] prisma.animalRegistration.groupBy({ — `where: { organizationId:
#            orgId }` is the entire filter, on the line below the call.
#
# Employee bank-details self-serve link (employee.service.ts) entries:
#   [VERIFIED-ID] await prisma.employee.update({ in requestBankDetails —
#            updates the SAME row returned by getEmployeeInOrg(orgId, ...)
#            two lines above, which already throws NOT_FOUND when
#            employee.organizationId !== orgId.
#   [TOKEN]  await prisma.employee.update({ in submitBankDetails, and
#            const employee = await prisma.employee.findUnique({ in
#            findEmployeeByBankLink — both operate on the row resolved by a
#            single-use hashed bankLinkToken on a PUBLIC endpoint with no
#            session and no caller-asserted org. See the [TOKEN] category
#            above.
ALLOWLIST_FILE=$(mktemp)
trap 'rm -f "$ALLOWLIST_FILE"' EXIT
cat > "$ALLOWLIST_FILE" <<'EOF'
apps/api/src/services/attendance.service.ts	const employee = await prisma.employee.findUnique({
apps/api/src/services/attendance.service.ts	const employees = await prisma.employee.findMany({
apps/api/src/services/bin.service.ts	const activeBins = await prisma.bin.findMany({
apps/api/src/services/bin.service.ts	const activeBins = await prisma.bin.findMany({
apps/api/src/services/bin.service.ts	const bin = await prisma.bin.findFirst({
apps/api/src/services/bin.service.ts	const binType = await prisma.binType.findUnique({
apps/api/src/services/bin.service.ts	const binType = await prisma.binType.findUnique({
apps/api/src/services/bin.service.ts	const exactBin = await prisma.bin.findUnique({
apps/api/src/services/bin.service.ts	let bin = await prisma.bin.findUnique({
apps/api/src/services/bin.service.ts	prisma.bin.count({ where }),
apps/api/src/services/bin.service.ts	prisma.bin.findMany({
apps/api/src/services/blockchain.service.ts	const result = await prisma.binCycle.updateMany({
apps/api/src/services/blockchain.service.ts	return prisma.binCycle.findMany({
apps/api/src/services/cycle.service.ts	const bin = await prisma.bin.findFirst({
apps/api/src/services/cycle.service.ts	const cycle = await prisma.binCycle.findUnique({
apps/api/src/services/cycle.service.ts	prisma.binCycle.count({ where }),
apps/api/src/services/cycle.service.ts	prisma.binCycle.findMany({
apps/api/src/services/cycle.service.ts	prisma.binCycle.findMany({
apps/api/src/services/dashboard.service.ts	const overdueByFacility = await prisma.binCycle.groupBy({
apps/api/src/services/dashboard.service.ts	prisma.binCycle.count({
apps/api/src/services/dashboard.service.ts	prisma.binCycle.count({
apps/api/src/services/dashboard.service.ts	prisma.binCycle.count({
apps/api/src/services/dashboard.service.ts	prisma.binCycle.count({
apps/api/src/services/dashboard.service.ts	prisma.binCycle.count({ where }),
apps/api/src/services/dashboard.service.ts	prisma.binCycle.count({ where }),
apps/api/src/services/dashboard.service.ts	prisma.binCycle.findMany({
apps/api/src/services/dashboard.service.ts	prisma.binCycle.findMany({
apps/api/src/services/dashboard.service.ts	prisma.facility.findMany({
apps/api/src/services/employee.service.ts	await prisma.employee.update({
apps/api/src/services/employee.service.ts	await prisma.employee.update({
apps/api/src/services/employee.service.ts	const employee = await prisma.employee.findUnique({
apps/api/src/services/employee.service.ts	const employee = await prisma.employee.findUnique({ where: { id } });
apps/api/src/services/employee.service.ts	return await prisma.employee.create({
apps/api/src/services/employee.service.ts	return prisma.employee.findMany({
apps/api/src/services/facility.service.ts	const facility = await prisma.facility.findFirst({
apps/api/src/services/facility.service.ts	prisma.facility.count({ where }),
apps/api/src/services/facility.service.ts	prisma.facility.findMany({
apps/api/src/services/facility.service.ts	return await prisma.facility.update({ where: { id }, data });
apps/api/src/services/facility.service.ts	return prisma.facility.update({
apps/api/src/services/farmer.service.ts	const record = await prisma.animalRegistration.create({
apps/api/src/services/farmer.service.ts	return prisma.animalRegistration.findMany({
apps/api/src/services/farmer.service.ts	prisma.animalRegistration.groupBy({
apps/api/src/services/form.service.ts	const maxSort = await prisma.formTemplate.aggregate({
apps/api/src/services/form.service.ts	const row = await prisma.formTemplate.create({
apps/api/src/services/form.service.ts	const row = await prisma.formTemplate.findUnique({ where: { id } });
apps/api/src/services/form.service.ts	const rows = await prisma.formTemplate.findMany({
apps/api/src/services/payroll.service.ts	const existing = await prisma.payrollRun.findUnique({
apps/api/src/services/payroll.service.ts	const run = await prisma.payrollRun.findUnique({
apps/api/src/services/payroll.service.ts	const runs = await prisma.payrollRun.findMany({
apps/api/src/services/shipment.service.ts	const row = await prisma.shipment.create({
apps/api/src/services/shipment.service.ts	const row = await prisma.shipment.findUnique({
apps/api/src/services/shipment.service.ts	const rows = await prisma.shipment.findMany({
apps/api/src/services/shipment.service.ts	return prisma.facility.findMany({
EOF

# Occurrence-count comparison (not set membership): for each (file, content)
# key, awk's associative arrays (native to awk, unlike bash 3.2, so no
# bash-4 dependency) tally how many times it appears in CURRENT vs.
# ALLOWLIST_FILE. A key is unexplained only for the amount by which
# CURRENT's count exceeds ALLOWLIST's count — i.e. a new, additional
# occurrence of an already-allowlisted line, not just a brand-new string.
UNEXPLAINED=$(awk -F'\t' '
    NR==FNR { cur[$0]++; next }
    { allow[$0]++ }
    END {
        for (key in cur) {
            excess = cur[key] - allow[key]
            for (i = 0; i < excess; i++) print key
        }
    }
' <(echo "$CURRENT") "$ALLOWLIST_FILE" | sort || true)

if [ -n "$UNEXPLAINED" ]; then
    echo "TENANCY AUDIT FAILED"
    echo ""
    echo "The following prisma.<model>.<method>( call(s) in apps/api/src/services/"
    echo "have no organizationId on their own line and are NOT in the reviewed"
    echo "allowlist in apps/api/scripts/tenancy-audit.sh. Manually verify each is"
    echo "genuinely org-scoped (via a filter variable, compound key, post-fetch"
    echo "check, or is a .create() writing organizationId), then either fix the"
    echo "query or add it to ALLOWLIST with a category comment."
    echo ""
    echo "$UNEXPLAINED"
    exit 1
fi

HIT_COUNT=$(echo "$CURRENT" | grep -c . || true)
echo "Tenancy audit passed: $HIT_COUNT known-safe hit(s), 0 unexplained."
