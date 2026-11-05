/**
 * Re-fetches a query after a mutation, GUARANTEEING fresh data.
 *
 * A plain `invalidate()` has a trap: if the query's very first fetch is still
 * in flight (no data yet), TanStack Query merges the refetch into that stale
 * request instead of starting a new one — so a save made right after the page
 * opens would not show up until a reload. Cancelling first removes the
 * in-flight request, so `invalidate()` always issues a fresh one.
 */
export async function refreshQuery(query: { cancel: () => Promise<void>; invalidate: () => Promise<void> }): Promise<void> {
    await query.cancel();
    await query.invalidate();
}
