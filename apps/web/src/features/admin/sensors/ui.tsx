import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { trpc, type RouterOutputs } from '../../../lib/trpc';

export type FleetRow = RouterOutputs['sensorAdmin']['listFleetDevices']['rows'][number];

/** Renders children only for platform admins. The server's platformAdminProcedure is the real gate; this only avoids showing a broken page. */
export function PlatformAdminGate({ children }: { children: ReactNode }) {
  const whoAmI = trpc.admin.whoAmI.useQuery();
  if (whoAmI.isLoading) return <CenteredMessage>Loading…</CenteredMessage>;
  if (!whoAmI.data?.isPlatformAdmin) return <CenteredMessage>Access denied. Platform admin only.</CenteredMessage>;
  return <>{children}</>;
}

export function CenteredMessage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted">{children}</div>;
}

export function Th({ children }: { children?: ReactNode }) {
  return <th className="px-5 py-3 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">{children}</th>;
}

export function EmptyRow({
  children,
  colSpan,
  tone = 'muted',
}: {
  children: ReactNode;
  colSpan: number;
  tone?: 'muted' | 'alert';
}) {
  return (
    <tr>
      <td colSpan={colSpan} className={`px-5 py-8 text-center ${tone === 'alert' ? 'text-rust' : 'text-muted'}`}>
        {children}
      </td>
    </tr>
  );
}

/** A router link styled like the secondary Button primitive. */
export function LinkButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-olive-deep transition-colors hover:bg-bone-light"
    >
      {children}
    </Link>
  );
}

export const selectClass =
  'rounded-lg border border-edge bg-white px-3 py-2 text-sm font-semibold text-olive-deep';
export const inputClass = 'rounded-lg border border-edge bg-white px-3 py-2 text-sm text-olive-deep';
