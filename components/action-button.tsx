import { cn } from "@/lib/utils";

type ActionButtonProps = {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
};

export function ActionButton({ children, icon, variant = "primary", className }: ActionButtonProps) {
  const variantClasses = {
    primary: "border-acv-teal/40 bg-acv-teal text-black hover:bg-cyan-200",
    ghost: "border-acv-border bg-white/[0.03] text-acv-text hover:border-acv-teal/50 hover:text-acv-teal",
    danger: "border-acv-pink/40 bg-acv-pink/10 text-acv-pink hover:bg-acv-pink/15"
  };

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition",
        variantClasses[variant],
        className
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
