import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="border-b border-border bg-surface-subtle">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8">
        <div className="max-w-2xl">
          {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">{eyebrow}</p>}
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
