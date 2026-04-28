"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SmartDeviceRow = {
  id: number;
  device: string;
  room: string;
  type: string;
  status: "Online" | "Offline" | "Warning";
  power: string;
  lastActive: string;
};

const defaultData: SmartDeviceRow[] = [
  {
    id: 1,
    device: "Living Room Lights",
    room: "Living Room",
    type: "Lighting",
    status: "Online",
    power: "12W",
    lastActive: "2 min ago",
  },
  {
    id: 2,
    device: "Main Door Sensor",
    room: "Entrance",
    type: "Security",
    status: "Online",
    power: "Battery 86%",
    lastActive: "5 min ago",
  },
  {
    id: 3,
    device: "Kitchen Smart Plug",
    room: "Kitchen",
    type: "Power",
    status: "Warning",
    power: "740W",
    lastActive: "12 min ago",
  },
  {
    id: 4,
    device: "Bedroom Thermostat",
    room: "Bedroom",
    type: "Climate",
    status: "Online",
    power: "24°C",
    lastActive: "Now",
  },
  {
    id: 5,
    device: "Garage Camera",
    room: "Garage",
    type: "Security",
    status: "Offline",
    power: "0W",
    lastActive: "1 hr ago",
  },
];

const defaultColumns: ColumnDef<SmartDeviceRow>[] = [
  {
    accessorKey: "device",
    header: "Device",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-white">{row.original.device}</p>
        <p className="text-xs text-muted-foreground">ID #{row.original.id}</p>
      </div>
    ),
  },
  {
    accessorKey: "room",
    header: "Room",
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className="rounded-full border-blue-500/20 bg-blue-500/10 text-blue-400"
      >
        {row.original.type}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "power",
    header: "Power / Reading",
  },
  {
    accessorKey: "lastActive",
    header: "Last Active",
  },
];

type DataTableProps<TData> = {
  data?: TData[];
  columns?: ColumnDef<TData>[];
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  addLabel?: string;
  className?: string;
};

export function DataTable<TData>({
  data,
  columns,
  title = "Device Activity",
  description = "Monitor connected devices, current state, and recent activity.",
  searchPlaceholder = "Search devices...",
  addLabel = "Add Device",
  className,
}: DataTableProps<TData>) {
  const tableData = (data ?? defaultData) as TData[];
  const tableColumns = (columns ?? defaultColumns) as ColumnDef<TData>[];

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <section
      className={cn(
        "rounded-3xl border border-white/10 bg-card/80 p-4 shadow-xl shadow-black/20 backdrop-blur md:p-5",
        className
      )}
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-full border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-muted-foreground sm:w-64"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
              >
                <Columns3Icon className="size-4" />
                Columns
                <ChevronDownIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="rounded-xl border-white/10 bg-[#111827] text-white"
            >
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(Boolean(value))
                    }
                    className="capitalize"
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            className="rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400"
          >
            <PlusIcon className="size-4" />
            {addLabel}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <Table>
          <TableHeader className="bg-white/[0.04]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-white/10 hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-11 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-white/10 transition hover:bg-white/[0.03]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={tableColumns.length}
                  className="h-28 text-center text-muted-foreground"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {table.getRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} records
        </p>

        <div className="flex items-center gap-3">
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-20 rounded-full border-white/10 bg-white/[0.04]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-white/10 bg-[#111827] text-white">
              {[5, 10, 20, 30].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-full border-white/10 bg-white/[0.04] hover:bg-white/10"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-full border-white/10 bg-white/[0.04] hover:bg-white/10"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: SmartDeviceRow["status"] }) {
  const classes = {
    Online: "border-green-500/20 bg-green-500/10 text-green-400",
    Offline: "border-red-500/20 bg-red-500/10 text-red-400",
    Warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  };

  return (
    <Badge
      variant="outline"
      className={cn("rounded-full", classes[status])}
    >
      <span className="mr-1.5 size-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  );
}