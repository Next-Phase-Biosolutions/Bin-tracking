import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { Button, Card, SectionHead } from '../../../components/ui/primitives';
import { formatAgo } from './format';
import { describeSample, nextSelection } from './unknown-ids';
import { EmptyRow, Th } from './ui';

export function UnknownIdsCard() {
  const utils = trpc.useUtils();
  const list = trpc.sensorAdmin.listUnknownIds.useQuery(undefined, { refetchInterval: 30_000 });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const onDone = async () => {
    setSelected(new Set());
    await utils.sensorAdmin.invalidate();
  };
  const add = trpc.sensorAdmin.addDevices.useMutation({ onSuccess: onDone });
  const dismiss = trpc.sensorAdmin.dismissUnknownIds.useMutation({ onSuccess: onDone });
  const clear = trpc.sensorAdmin.clearUnknownIds.useMutation({ onSuccess: onDone });

  const rows = list.data ?? [];
  const listedIds = rows.map((row) => row.externalId);
  // Never act on a row that has since disappeared from the list.
  const chosen = listedIds.filter((id) => selected.has(id));
  const busy = add.isPending || dismiss.isPending || clear.isPending;
  const error = add.error ?? dismiss.error ?? clear.error;
  const now = new Date();

  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-3">
        <SectionHead title="Unknown ids" />
        <p className="mt-1 text-xs text-muted">
          Sent with a valid key but not registered, so no reading is stored. The sample is the latest request from that id — use it to tell
          test devices apart. Add the ones that are real; dismiss typos and strays (they come back only if the device sends again).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button disabled={chosen.length === 0 || busy} onClick={() => add.mutate({ externalIds: chosen })}>
            {add.isPending ? 'Adding…' : `Add selected${chosen.length ? ` (${chosen.length})` : ''}`}
          </Button>
          <Button variant="secondary" disabled={chosen.length === 0 || busy} onClick={() => dismiss.mutate({ externalIds: chosen })}>
            Dismiss selected
          </Button>
          <Button
            variant="secondary"
            disabled={rows.length === 0 || busy}
            onClick={() => {
              if (window.confirm(`Clear all ${rows.length} unknown ids from this list? Registered devices are not affected.`)) clear.mutate();
            }}
          >
            Clear all
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-edge/60">
              <th className="w-10 px-5 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all unknown ids"
                  checked={rows.length > 0 && chosen.length === rows.length}
                  onChange={() => setSelected(nextSelection(selected, listedIds, { all: true }))}
                />
              </th>
              <Th>Device id</Th>
              <Th>Last sent</Th>
              <Th>First seen</Th>
              <Th>Last seen</Th>
              <Th>Attempts</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/40">
            {list.isLoading ? (
              <EmptyRow colSpan={6}>Loading…</EmptyRow>
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={6}>No unregistered ids have been seen recently.</EmptyRow>
            ) : (
              rows.map((row) => (
                <tr key={row.externalId}>
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.externalId}`}
                      checked={selected.has(row.externalId)}
                      onChange={() => setSelected(nextSelection(selected, listedIds, { toggle: row.externalId }))}
                    />
                  </td>
                  <td className="px-5 py-3 font-mono text-sm">{row.externalId}</td>
                  <td className="max-w-xs truncate px-5 py-3 font-mono text-xs text-muted" title={describeSample(row)}>
                    {describeSample(row)}
                  </td>
                  <td className="px-5 py-3 text-muted">{formatAgo(row.firstSeenAt, now)}</td>
                  <td className="px-5 py-3 text-muted">{formatAgo(row.lastSeenAt, now)}</td>
                  <td className="px-5 py-3 tnum">{row.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {error ? <p className="px-5 pb-4 text-sm text-rust">{error.message}</p> : null}
    </Card>
  );
}
