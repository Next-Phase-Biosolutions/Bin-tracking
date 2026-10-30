import { useState } from 'react';
import { ZONE_ICON_NAMES, type ZoneIconName } from '@bin-tracker/types';
import { trpc, type RouterOutputs } from '../../lib/trpc';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Button, Card, SectionHead } from '../../components/ui/primitives';
import { inputClass, PlatformAdminGate, selectClass } from './sensors/ui';
import { moveZone } from './zones-order';

type Zone = RouterOutputs['zone']['adminList'][number];

export default function ZonesAdminPage() {
  return (
    <PlatformAdminGate>
      <ZonesContent />
    </PlatformAdminGate>
  );
}

function ZonesContent() {
  const [organizationId, setOrganizationId] = useState('');
  const [facilityId, setFacilityId] = useState('');

  const orgs = trpc.admin.listOrganizations.useQuery();
  const options = trpc.sensorAdmin.orgAssignmentOptions.useQuery({ organizationId }, { enabled: organizationId !== '' });
  const facilities = options.data?.facilities ?? [];
  // Derived, so switching organization can't leave a facility from the previous one selected.
  const activeFacilityId = facilities.some((f) => f.id === facilityId) ? facilityId : (facilities[0]?.id ?? '');

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Zones"
        subtitle="The areas of each facility. Their names and order drive the sidebar and the zone pages."
        icon={<Icon name="grid" width={22} height={22} />}
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <select aria-label="Organization" className={selectClass} value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
          <option value="">Choose an organization…</option>
          {(orgs.data ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Facility"
          className={selectClass}
          value={activeFacilityId}
          disabled={facilities.length === 0}
          onChange={(e) => setFacilityId(e.target.value)}
        >
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      {activeFacilityId ? <ZoneEditor facilityId={activeFacilityId} /> : <p className="text-sm text-muted">Choose an organization and facility to edit its zones.</p>}
    </div>
  );
}

function ZoneEditor({ facilityId }: { facilityId: string }) {
  const utils = trpc.useUtils();
  const zones = trpc.zone.adminList.useQuery({ facilityId });
  const refresh = () => utils.zone.invalidate();
  const reorder = trpc.zone.adminReorder.useMutation({ onSuccess: refresh });

  const rows = zones.data ?? [];
  const ids = rows.map((z) => z.id);
  const error = reorder.error;

  return (
    <Card className="p-5">
      <SectionHead title="Zones in this facility" />
      <ul className="mt-3 divide-y divide-edge/40">
        {zones.isLoading ? <li className="py-4 text-sm text-muted">Loading…</li> : null}
        {rows.map((zone, index) => (
          <ZoneRow
            key={zone.id}
            zone={zone}
            canMoveUp={index > 0}
            canMoveDown={index < rows.length - 1}
            busy={reorder.isPending}
            onMove={(delta) => reorder.mutate({ facilityId, zoneIds: moveZone(ids, index, delta) })}
          />
        ))}
      </ul>
      {error ? <p className="mt-3 text-sm text-rust">{error.message}</p> : null}
      <AddZoneForm facilityId={facilityId} />
    </Card>
  );
}

function ZoneRow({
  zone,
  canMoveUp,
  canMoveDown,
  busy,
  onMove,
}: {
  zone: Zone;
  canMoveUp: boolean;
  canMoveDown: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
}) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const rename = trpc.zone.adminRename.useMutation({
    onSuccess: async () => {
      setDraft(null);
      await utils.zone.invalidate();
    },
  });
  // Owned by the row so a refusal ("Zone has assigned devices") shows on THIS row and leaves its Delete state.
  const remove = trpc.zone.adminRemove.useMutation({
    onSuccess: () => utils.zone.invalidate(),
    onError: () => setConfirmRemove(false),
  });
  const name = draft?.trim() ?? '';

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Icon name={zone.icon} width={16} height={16} className="text-olive" />
      {draft === null ? (
        <>
          <span className="min-w-[8rem] flex-1 font-semibold text-olive-deep">{zone.name}</span>
          <span className="font-mono text-[0.62rem] text-muted">/{zone.slug}</span>
          <Button variant="ghost" onClick={() => setDraft(zone.name)}>
            Rename
          </Button>
        </>
      ) : (
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name) rename.mutate({ zoneId: zone.id, name });
          }}
        >
          <input aria-label="Zone name" className={`${inputClass} flex-1`} value={draft} maxLength={60} onChange={(e) => setDraft(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={!name || rename.isPending}>
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </form>
      )}
      <div className="flex items-center gap-1">
        <Button variant="ghost" aria-label={`Move ${zone.name} up`} disabled={!canMoveUp || busy} onClick={() => onMove(-1)}>
          ↑
        </Button>
        <Button variant="ghost" aria-label={`Move ${zone.name} down`} disabled={!canMoveDown || busy} onClick={() => onMove(1)}>
          ↓
        </Button>
        {confirmRemove ? (
          <>
            <Button variant="rust" disabled={busy || remove.isPending} onClick={() => remove.mutate({ zoneId: zone.id })}>
              Remove
            </Button>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            onClick={() => {
              remove.reset();
              setConfirmRemove(true);
            }}
          >
            Delete
          </Button>
        )}
      </div>
      {rename.isError ? <p className="basis-full text-sm text-rust">{rename.error.message}</p> : null}
      {remove.isError ? <p className="basis-full text-sm text-rust">{remove.error.message}</p> : null}
    </li>
  );
}

function AddZoneForm({ facilityId }: { facilityId: string }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<ZoneIconName>('grid');
  const create = trpc.zone.adminCreate.useMutation({
    onSuccess: async () => {
      setName('');
      await utils.zone.invalidate();
    },
  });
  const trimmed = name.trim();

  return (
    <form
      className="mt-5 flex flex-wrap items-center gap-2 border-t border-edge/60 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) create.mutate({ facilityId, name: trimmed, icon });
      }}
    >
      <Icon name={icon} width={16} height={16} className="text-olive" />
      <select aria-label="Icon" className={selectClass} value={icon} onChange={(e) => setIcon(e.target.value as ZoneIconName)}>
        {ZONE_ICON_NAMES.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <input aria-label="New zone name" className={`${inputClass} min-w-[12rem] flex-1`} placeholder="New zone name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" disabled={!trimmed || create.isPending}>
        Add zone
      </Button>
      {create.isError ? <p className="basis-full text-sm text-rust">{create.error.message}</p> : null}
    </form>
  );
}
