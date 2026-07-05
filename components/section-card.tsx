import { cn } from "@/lib/utils";

type SectionCardProps = {
  title?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function SectionCard({ title, eyebrow, action, children, className }: SectionCardProps) {
  return (
    <section className={cn("rounded-lg border border-acv-border bg-acv-panel/88 shadow-glow", className)}>
      {(title || eyebrow || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-acv-border px-4 py-3">
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-acv-gold">{eyebrow}</p>}
            {title && <h2 className="truncate text-sm font-semibold text-acv-text">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
