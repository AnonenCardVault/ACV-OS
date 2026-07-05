import { cn } from "@/lib/utils";

const toneMap = {
  green: "border-acv-green/30 bg-acv-green/10 text-acv-green",
  teal: "border-acv-teal/30 bg-acv-teal/10 text-acv-teal",
  gold: "border-acv-gold/35 bg-acv-gold/10 text-acv-gold",
  pink: "border-acv-pink/30 bg-acv-pink/10 text-acv-pink",
  purple: "border-acv-purple/35 bg-acv-purple/10 text-violet-200",
  neutral: "border-acv-border bg-white/[0.03] text-acv-muted"
};

type StatusPillProps = {
  children: React.ReactNode;
  tone?: keyof typeof toneMap;
  className?: string;
};

export function StatusPill({ children, tone = "neutral", className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
        toneMap[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
