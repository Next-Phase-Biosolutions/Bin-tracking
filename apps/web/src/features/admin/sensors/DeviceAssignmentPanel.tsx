import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { Button, Card, SectionHead } from '../../../components/ui/primitives';
import { describeReassignImpact, isAssignmentComplete, resolvePlacement } from './assignment';
import { inputClass, selectClass, type FleetRow } from './ui';

interface DeviceAssignmentPanelProps {
  device: FleetRow;
  /** `assign` for an UNASSIGNED device; `reassign` moves an ACTIVE one. */
  mode: 'assign' | 'reassign';
  onDone: () => void;
  onCancel?: () => void;
}

/**
 * Pick organization → facility → zone and give the device its tenant-facing
 * name. The facility and zone shown are derived from the organization's loaded
 * options, so changing the organization can never leave a stale selection.
 */
export function DeviceAssignmentPanel({ device, mode, onDone, onCancel }: DeviceAssignmentPanelProps) {
  const utils = trpc.useUtils();
  const orgs = trpc.admin.listOrganizations.useQuery();

  const [organizationId, setOrganizationId] = useState(device.organization?.id ?? '');
  const [facilityId, setFacilityId] = useState(device.facility?.id ?? '');
  const [zoneId, setZoneId] = useState(device.zone?.id ?? '');
  const [name, setName] = useState(device.name);
  const [enableModule, setEnableModule] = useState(false);

  const optionsQuery = trpc.sensorAdmin.orgAssignmentOptions.useQuery({ organizationId }, { enabled: organizationId !== '' });
  const options = optionsQuery.data;
  const placement = options ? resolvePlacement(options, facilityId, zoneId) : { facilityId: '', zoneId: '' };
  const zones = options?.facilities.find((f) => f.id === placement.facilityId)?.zones ?? [];

  const onSuccess = async () => {
    await utils.sensorAdmin.invalidate();
    onDone();
  };
  const assign = trpc.sensorAdmin.assignDevice.useMutation({ onSuccess });
  const reassign = trpc.sensorAdmin.reassignDevice.useMutation({ onSuccess });
  const mutation = mode === 'assign' ? assign : reassign;

  const form = { organizationId, ...placement, name };
  const complete = isAssignmentComplete(form);
  const impact =
    mode === 'reassign'
      ? describeReassignImpact({
          currentOrgId: device.organization?.id ?? null,
          currentOrgName: device.organization?.name ?? null,
          nextOrgId: organizationId,
        })
      : null;
  const moduleOff = options !== undefined && !options.moduleEnabled;

  return (
    <Card className="p-5">
      <SectionHead title={mode === 'assign' ? `Assign ${device.externalId}` : `Reassign ${device.name}`} />
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!complete) return;
          mutation.mutate({ deviceId: device.id, ...form, name: name.trim(), enableModule });
        }}
      >
        <label className="grid gap-1 text-xs font-semibold text-muted">
          Organization
          <select className={selectClass} value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
            <option value="">Select…</option>
            {(orgs.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-semibold text-muted">
          Facility
          <select
            className={selectClass}
            value={placement.facilityId}
            disabled={!options || options.facilities.length === 0}
            onChange={(e) => {
              setFacilityId(e.target.value);
              setZoneId('');
            }}
          >
            {(options?.facilities ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-semibold text-muted">
          Zone
          <select className={selectClass} value={placement.zoneId} disabled={zones.length === 0} onChange={(e) => setZoneId(e.target.value)}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-semibold text-muted">
          Device name (shown to the tenant)
          <input className={inputClass} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>

        {options && options.facilities.length === 0 ? (
          <p className="text-sm text-rust sm:col-span-2">This organization has no facilities, so a device cannot be placed.</p>
        ) : null}

        {moduleOff ? (
          <label className="flex items-start gap-2 rounded-lg bg-warn/10 p-3 text-sm text-olive-deep sm:col-span-2">
            <input type="checkbox" className="mt-1" checked={enableModule} onChange={(e) => setEnableModule(e.target.checked)} />
            <span>
              This organization does not have <strong>Environment Monitoring</strong> enabled, so its users will not see this sensor.
              Enable it for this organization as part of assigning.
            </span>
          </label>
        ) : null}

        {impact ? <p className="rounded-lg bg-bone-light p-3 text-sm text-muted sm:col-span-2">{impact}</p> : null}
        {mutation.isError ? <p className="text-sm text-rust sm:col-span-2">{mutation.error.message}</p> : null}

        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={!complete || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : mode === 'assign' ? 'Assign device' : 'Save changes'}
          </Button>
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
