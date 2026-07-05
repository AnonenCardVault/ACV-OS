import { cn } from "@/lib/utils";

type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Array<Column<T>>;
  rows: T[];
  getRowKey: (row: T) => string;
  className?: string;
  onRowClick?: (row: T) => void;
};

export function DataTable<T>({ columns, rows, getRowKey, className, onRowClick }: DataTableProps<T>) {
  return (
    <div className={cn("acv-scrollbar max-w-full overflow-x-auto", className)}>
      <table className="w-max min-w-full border-separate border-spacing-0 text-left text-xs">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "sticky top-0 border-b border-acv-border bg-acv-panel2 px-3 py-2 font-semibold uppercase tracking-[0.09em] text-acv-muted",
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn("group", onRowClick && "cursor-pointer")}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "border-b border-acv-border/70 px-3 py-2 align-middle text-acv-text group-hover:bg-white/[0.025]",
                    column.className
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
