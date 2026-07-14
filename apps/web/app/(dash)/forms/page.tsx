"use client";

import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, Reveal, Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { useForms } from "@/lib/live-data";

export default function FormsPage() {
  const forms = useForms();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Forms"
        subtitle="Compliance records filled by voice, photo, or by hand — sealed automatically."
        icon={<Icon name="form" width={22} height={22} />}
        actions={
          <>
            <Link href="/forms/import">
              <Button variant="secondary">
                <Icon name="camera" width={15} height={15} />
                From Photo
              </Button>
            </Link>
            <Button variant="primary">
              <Icon name="bolt" width={15} height={15} />
              Manual Builder
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {forms.map((f, i) => (
          <Reveal key={f.id} delay={i * 0.04}>
            <Card className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-bold leading-snug text-olive-deep">{f.name}</h3>
                <Badge tone={f.type === "Checklist" ? "good" : "active"}>{f.type}</Badge>
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{f.desc}</p>
              <div className="mt-4 flex items-center justify-between border-t border-edge/60 pt-4">
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">{f.fields} fields</span>
                <Link href={`/forms/${f.id}`}>
                  <Button variant="primary" className="px-4 py-2 text-xs">
                    Fill Form
                    <Icon name="arrow" width={14} height={14} />
                  </Button>
                </Link>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
