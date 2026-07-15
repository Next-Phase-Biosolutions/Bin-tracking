import type { SVGProps } from "react";
import * as I from "./icons";

const map: Record<string, (p: SVGProps<SVGSVGElement>) => JSX.Element> = {
  grid: I.IconGrid,
  truck: I.IconTruck,
  blade: I.IconBlade,
  knife: I.IconKnife,
  snow: I.IconSnow,
  box: I.IconBox,
  ship: I.IconShip,
  form: I.IconForm,
  clock: I.IconClock,
  badge: I.IconBadge,
  users: I.IconUsers,
  cow: I.IconCow,
  scan: I.IconScan,
  bin: I.IconBin,
  mic: I.IconMic,
  chain: I.IconChain,
  thermo: I.IconThermo,
  drop: I.IconDrop,
  gas: I.IconGas,
  bolt: I.IconBolt,
  check: I.IconCheck,
  refresh: I.IconRefresh,
  arrow: I.IconArrowRight,
  camera: I.IconCamera,
  leaf: I.IconLeaf,
  logout: I.IconLogout,
  upload: I.IconUpload,
};

export function Icon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const Cmp = map[name] ?? I.IconGrid;
  return <Cmp {...props} />;
}
