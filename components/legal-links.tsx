import Link from "next/link";
import { cn } from "@/lib/utils";

export function LegalLinks({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-acv-muted", className)}>
      <Link href="/privacy" className="transition hover:text-acv-teal">
        Privacy
      </Link>
      <span className="text-acv-border">/</span>
      <Link href="/terms" className="transition hover:text-acv-teal">
        Terms
      </Link>
    </div>
  );
}
