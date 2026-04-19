"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
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
    cell: (info) => <Badge variant={info.getValue() === "PAID" ? "success" : "warning"}>{info.getValue()}</Badge>,
  }),
  columnHelper.accessor("subtotal", {
    header: "Subtotal",
    cell: (info) => formatMoney(info.getValue()),
  }),
  columnHelper.accessor("orderDate", {
    header: "Order date",
    cell: (info) => formatShortDate(info.getValue()),
  }),
];

export function OrdersTable({ data }: { data: OrderRow[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <TableWrapper>
      <Table>
        <TableHead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Th key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </Th>
              ))}
            </tr>
          ))}
        </TableHead>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Td>
              ))}
            </tr>
          ))}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}
