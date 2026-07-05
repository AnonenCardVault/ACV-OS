import { StatusPill } from "@/components/status-pill";

type PageHeaderProps = {
  title: string;
  description: string;
  status?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, description, status = "Mock data", action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-acv-border bg-acv-black/65 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusPill tone="purple">{status}</StatusPill>
          <StatusPill tone="teal">ACV OS v1 shell</StatusPill>
        </div>
        <h1 className="text-xl font-semibold tracking-normal text-acv-text md:text-2xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-acv-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
