import { cn } from "@/lib/utils";

const toneMap = {
  green: "text-acv-green border-acv-green/30",
  teal: "text-acv-teal border-acv-teal/30",
  gold: "text-acv-gold border-acv-gold/35",
  pink: "text-acv-pink border-acv-pink/30",
  purple: "text-violet-200 border-acv-purple/35"
};

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: keyof typeof toneMap;
};

export function MetricCard({ label, value, detail, tone = "purple" }: MetricCardProps) {
  return (
    <div className={cn("rounded-lg border bg-acv-panel2/82 p-4", toneMap[tone])}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-acv-muted">{label}</p>
        <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_20px_currentColor]" />
      </div>
      <p className="mt-3 text-2xl font-semibold leading-none text-acv-text">{value}</p>
      <p className={cn("mt-2 text-xs", toneMap[tone].split(" ")[0])}>{detail}</p>
    </div>
  );
}
