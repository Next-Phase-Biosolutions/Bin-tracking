import { useState } from 'react';
import { Link } from 'react-router-dom';
import { parseDeviceIdList } from '@bin-tracker/types';
import { trpc, type RouterOutputs } from '../../../lib/trpc';
import { PageHeader } from '../../../components/app/PageHeader';
import { Icon } from '../../../components/ui/Icon';
import { Badge, Button, Card, SectionHead } from '../../../components/ui/primitives';
import { DeviceAssignmentPanel } from './DeviceAssignmentPanel';
import { DeviceLifecycleButtons } from './DeviceLifecycleButtons';
import { formatAgo } from './format';
import { EmptyRow, LinkButton, PlatformAdminGate, Th, type FleetRow } from './ui';

const MAX_BATCH = 500;
type AddResult = RouterOutputs['sensorAdmin']['addDevices'];

export default function SensorRegisterPage() {
  return (
    <PlatformAdminGate>
      <RegisterContent />
    </PlatformAdminGate>
  );
}

function RegisterContent() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Register devices"
        subtitle="Add the vendor's device ids, then assign each to an organization."
        icon={<Icon name="thermo" width={22} height={22} />}
        actions={<LinkButton to="/app/admin/sensors">Back to fleet</LinkButton>}
      />
      <div className="grid gap-6">
        <AddDevicesCard />
        <UnassignedInbox />
        <UnknownIdsCard />
      </div>
    </div>
  );
}

function AddDevicesCard() {
  const utils = trpc.useUtils();
  const [text, setText] = useState('');
  const [result, setResult] = useState<AddResult | null>(null);
  const add = trpc.sensorAdmin.addDevices.useMutation({
    onSuccess: async (data) => {
      setResult(data);
      setText('');
      await utils.sensorAdmin.invalidate();
    },
  });

  const ids = parseDeviceIdList(text);
  const tooMany = ids.length > MAX_BATCH;

  return (
    <Card className="p-5">
      <SectionHead title="Add devices" />
      <p className="mt-2 text-xs text-muted">One id, or paste a list separated by new lines, spaces, commas or semicolons.</p>
      <textarea
        aria-label="Device ids"
        className="mt-3 h-32 w-full rounded-lg border border-edge bg-white p-3 font-mono text-sm text-olive-deep"
        placeholder={'MT-0001\nMT-0002\nMT-0003'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex items-center gap-3">
        <Button disabled={ids.length === 0 || tooMany || add.isPending} onClick={() => add.mutate({ externalIds: ids })}>
          {add.isPending ? 'Adding…' : `Add ${ids.length || ''} device${ids.length === 1 ? '' : 's'}`.trim()}
        </Button>
        <span className="text-xs text-muted">{tooMany ? `At most ${MAX_BATCH} at a time.` : `${ids.length} id${ids.length === 1 ? '' : 's'} found`}</span>
      </div>
      {add.isError ? <p className="mt-3 text-sm text-rust">{add.error.message}</p> : null}
      {result ? <AddResultSummary result={result} /> : null}
    </Card>
  );
}

function AddResultSummary({ result }: { result: AddResult }) {
  return (
    <div className="mt-4 grid gap-2 text-sm">
      <p>
        <Badge tone="good">added</Badge> <span className="ml-2">{result.added.length === 0 ? 'none' : result.added.join(', ')}</span>
      </p>
      {result.duplicates.length > 0 ? (
        <p>
          <Badge tone="idle">already registered</Badge> <span className="ml-2">{result.duplicates.join(', ')}</span>
        </p>
      ) : null}
      {result.invalid.length > 0 ? (
        <div>
          <Badge tone="alert">invalid</Badge>
          <ul className="ml-2 mt-1 list-disc pl-5 text-rust">
            {result.invalid.map((i) => (
              <li key={i.externalId}>
                <span className="font-mono">{i.externalId || '(blank)'}</span> — {i.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function UnassignedInbox() {
  const list = trpc.sensorAdmin.listFleetDevices.useQuery({ state: 'UNASSIGNED', page: 1, pageSize: 100 }, { refetchInterval: 30_000 });
  const [assigning, setAssigning] = useState<string | null>(null);
  const rows = list.data?.rows ?? [];

  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-3">
        <SectionHead title="Unassigned inbox" />
        <p className="mt-1 text-xs text-muted">Registered devices no tenant can see yet. They already record readings.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-edge/60">
              <Th>Device id</Th>
              <Th>Last seen</Th>
              <Th>Registered</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/40">
            {list.isLoading ? (
              <EmptyRow colSpan={4}>Loading…</EmptyRow>
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={4}>No devices waiting for assignment.</EmptyRow>
            ) : (
              rows.map((row) => <InboxRow key={row.id} row={row} assigning={assigning === row.id} onAssign={setAssigning} />)
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InboxRow({ row, assigning, onAssign }: { row: FleetRow; assigning: boolean; onAssign: (id: string | null) => void }) {
  const now = new Date();
  return (
    <>
      <tr>
        <td className="px-5 py-3">
          <Link to={`/app/admin/sensors/${row.id}`} className="font-mono text-sm font-semibold text-olive-deep hover:underline">
            {row.externalId}
          </Link>
        </td>
        <td className="px-5 py-3 text-muted">{formatAgo(row.lastSeenAt, now)}</td>
        <td className="px-5 py-3 text-muted">{formatAgo(row.createdAt, now)}</td>
        <td className="px-5 py-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => onAssign(assigning ? null : row.id)}>
              {assigning ? 'Close' : 'Assign'}
            </Button>
            <DeviceLifecycleButtons deviceId={row.id} state={row.state} />
          </div>
        </td>
      </tr>
      {assigning ? (
        <tr>
          <td colSpan={4} className="bg-bone-light/40 px-5 py-4">
            <DeviceAssignmentPanel device={row} mode="assign" onDone={() => onAssign(null)} onCancel={() => onAssign(null)} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function UnknownIdsCard() {
  const utils = trpc.useUtils();
  const list = trpc.sensorAdmin.listUnknownIds.useQuery(undefined, { refetchInterval: 30_000 });
  const add = trpc.sensorAdmin.addDevices.useMutation({ onSuccess: () => utils.sensorAdmin.invalidate() });
  const rows = list.data ?? [];
  const now = new Date();

  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-3">
        <SectionHead title="Unknown ids" />
        <p className="mt-1 text-xs text-muted">
          Sent with a valid key but not registered (nothing is stored). Often a typo in the vendor's list — add the id if it is a real device.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-edge/60">
              <Th>Device id</Th>
              <Th>First seen</Th>
              <Th>Last seen</Th>
              <Th>Attempts</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/40">
            {list.isLoading ? (
              <EmptyRow colSpan={5}>Loading…</EmptyRow>
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={5}>No unregistered ids have been seen recently.</EmptyRow>
            ) : (
              rows.map((row) => (
                <tr key={row.externalId}>
                  <td className="px-5 py-3 font-mono text-sm">{row.externalId}</td>
                  <td className="px-5 py-3 text-muted">{formatAgo(row.firstSeenAt, now)}</td>
                  <td className="px-5 py-3 text-muted">{formatAgo(row.lastSeenAt, now)}</td>
                  <td className="px-5 py-3 tnum">{row.count}</td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="secondary" disabled={add.isPending} onClick={() => add.mutate({ externalIds: [row.externalId] })}>
                      Add
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {add.isError ? <p className="px-5 pb-4 text-sm text-rust">{add.error.message}</p> : null}
    </Card>
  );
}
