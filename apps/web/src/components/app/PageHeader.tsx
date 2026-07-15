import { type ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-olive-deep text-bone-light">
            {icon}
          </span>
        ) : null}
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-olive-deep sm:text-3xl">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
