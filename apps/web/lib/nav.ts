/** Navigation config: sidebar groups (Facility Zones + Operations). */

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

/** FACILITY ZONES — the floor view. Main Dashboard is the unified (Main + Ops) dashboard. */
export const facilityNav: NavItem[] = [
  { label: "Main Dashboard", href: "/dashboard", icon: "grid" },
  { label: "Receiving", href: "/zones/receiving", icon: "truck" },
  { label: "Kill Floor", href: "/zones/killfloor", icon: "blade" },
  { label: "Processing", href: "/zones/processing", icon: "knife" },
  { label: "Wet Aging", href: "/zones/wetaging", icon: "snow" },
  { label: "Value Add", href: "/zones/valueadd", icon: "box" },
  { label: "Shipping", href: "/zones/shipping", icon: "ship" },
];

/** OPERATIONS — people, logistics, records, compliance. */
export const operationsNav: NavItem[] = [
  { label: "Driver Portal", href: "/driver", icon: "truck" },
  { label: "Bin Scanner", href: "/bin-scanner", icon: "scan" },
  { label: "Shipments", href: "/shipments", icon: "box" },
  { label: "Animal Registration", href: "/animal-registration", icon: "cow" },
  { label: "Employee Registration", href: "/employees/register", icon: "users" },
  { label: "Employee Scanner", href: "/employee-scanner", icon: "badge" },
  { label: "Timesheet", href: "/timesheet", icon: "clock" },
  { label: "Forms", href: "/forms", icon: "form" },
];
