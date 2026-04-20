"use client";

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableWrapper, Td, Th } from "@/components/ui/table";
import { formatMoney, formatShortDate } from "@/lib/utils";

type OrderRow = {
  orderNumber: string;
  customer: string;
  source: string;
  status: string;
  paymentState: string;
  subtotal: number;
  orderDate: string;
};

const columnHelper = createColumnHelper<OrderRow>();

const columns = [
  columnHelper.accessor("orderNumber", { header: "Order" }),
  columnHelper.accessor("customer", { header: "Customer" }),
  columnHelper.accessor("source", { header: "Channel" }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => <Badge>{info.getValue()}</Badge>,
  }),
  columnHelper.accessor("paymentState", {
    header: "Payment",
    cell: (info) => (
      <Badge variant={info.getValue() === "PAID" ? "success" : "warning"}>
        {info.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor("subtotal", {
    header: "Subtotal",
    cell: (info) => formatMoney(info.getValue()),
  }),
  columnHelper.accessor("orderDate", {
    header: "Date",
    cell: (info) => formatShortDate(info.getValue()),
  }),
];

export function OrdersTable({ data }: { data: OrderRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (sourceFilter !== "ALL" && row.source !== sourceFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          row.orderNumber.toLowerCase().includes(q) ||
          row.customer.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, search, statusFilter, sourceFilter]);

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search order or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-52 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="FULFILLED">Fulfilled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="ALL">All channels</option>
          <option value="SHOPIFY">Shopify</option>
          <option value="MANUAL">Manual</option>
        </select>
      </div>

      <TableWrapper>
        <Table>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </Th>
                ))}
              </tr>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <Td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  {data.length === 0
                    ? "No orders yet. Sync Shopify or create the first manual order."
                    : "No orders match the current filters."}
                </Td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <Td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Td>
                  ))}
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      </TableWrapper>
    </div>
  );
}
