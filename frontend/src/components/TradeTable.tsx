import React, { useState } from 'react';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
} from "@tanstack/react-table";
import type {
    ColumnDef,
    SortingState,
    ColumnFiltersState,
} from "@tanstack/react-table";
import {
    ArrowUpRight,
    ArrowDownRight,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight
} from 'lucide-react';
import { Skeleton } from './ui/Skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { cn } from "@/lib/utils";

interface Trade {
    tradeNo: number;
    datetime: string;
    type: string;
    price: number;
    shares: number;
    profit: number;
    comment: string;
}

interface TradeTableProps {
    trades: Trade[];
    loading?: boolean;
}

export const TradeTable: React.FC<TradeTableProps> = ({ trades, loading }) => {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    const columns: ColumnDef<Trade>[] = [
        {
            accessorKey: "tradeNo",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="flex items-center gap-1 -ml-2 font-bold uppercase tracking-wider text-[10px]"
                >
                    No
                    <ArrowUpDown size={12} />
                </Button>
            ),
            cell: ({ row }) => <div className="text-sm font-mono text-muted-foreground">{row.getValue("tradeNo")}</div>,
        },
        {
            accessorKey: "type",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="flex items-center gap-1 -ml-2 font-bold uppercase tracking-wider text-[10px]"
                >
                    Type
                    <ArrowUpDown size={12} />
                </Button>
            ),
            cell: ({ row }) => {
                const type = row.getValue("type") as string;
                return (
                    <span className={cn(
                        "flex items-center gap-1 text-sm font-bold",
                        type === 'BUY' ? 'text-blue-400' : 'text-primary'
                    )}>
                        {type === 'BUY' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                        {type}
                    </span>
                );
            },
        },
        {
            accessorKey: "price",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="flex items-center gap-1 -ml-2 font-bold uppercase tracking-wider text-[10px]"
                >
                    Price
                    <ArrowUpDown size={12} />
                </Button>
            ),
            cell: ({ row }) => <div className="text-sm font-mono">${(row.getValue("price") as number).toFixed(2)}</div>,
        },
        {
            accessorKey: "shares",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="flex items-center gap-1 -ml-2 font-bold uppercase tracking-wider text-[10px]"
                >
                    Shares
                    <ArrowUpDown size={12} />
                </Button>
            ),
            cell: ({ row }) => <div className="text-sm font-mono">{(row.getValue("shares") as number).toFixed(2)}</div>,
        },
        {
            accessorKey: "profit",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="flex items-center gap-1 -ml-2 font-bold uppercase tracking-wider text-[10px]"
                >
                    Profit
                    <ArrowUpDown size={12} />
                </Button>
            ),
            cell: ({ row }) => {
                const profit = row.getValue("profit") as number;
                return (
                    <div className={cn(
                        "text-sm font-mono",
                        profit > 0 ? 'text-primary' : profit < 0 ? 'text-red-400' : 'text-muted-foreground'
                    )}>
                        {profit !== 0 ? `$${profit.toFixed(2)}` : '-'}
                    </div>
                );
            },
        },
        {
            accessorKey: "datetime",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="flex items-center gap-1 -ml-2 font-bold uppercase tracking-wider text-[10px]"
                >
                    Date/Time
                    <ArrowUpDown size={12} />
                </Button>
            ),
            cell: ({ row }) => <div className="text-sm text-muted-foreground whitespace-nowrap">{row.getValue("datetime")}</div>,
        },
    ];

    const table = useReactTable({
        data: trades,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
        initialState: {
            pagination: {
                pageSize: 20,
            },
        },
    });

    return (
        <div className="mt-8 overflow-hidden rounded-xl border border-border glass flex flex-col">
            <div className="bg-muted/50 px-6 py-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <h3 className="font-semibold whitespace-nowrap">Trade Execution History</h3>

                <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    {/* Type Filter */}
                    <Select
                        value={(table.getColumn("type")?.getFilterValue() as string) ?? "ALL"}
                        onValueChange={(value) =>
                            table.getColumn("type")?.setFilterValue(value === "ALL" ? "" : value)
                        }
                    >
                        <SelectTrigger className="w-[110px] h-8 text-[11px] font-bold uppercase tracking-widest bg-background/50 border-border">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border glass">
                            <SelectItem value="ALL">All Types</SelectItem>
                            <SelectItem value="BUY">BUY</SelectItem>
                            <SelectItem value="SELL">SELL</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Page Size Selector */}
                    <div className="flex items-center gap-2 ml-auto">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Rows:</span>
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => table.setPageSize(Number(value))}
                        >
                            <SelectTrigger className="w-[65px] h-8 text-[11px] font-bold bg-background/50 border-border">
                                <SelectValue placeholder={table.getState().pagination.pageSize} />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border glass" side="top">
                                {[10, 20, 50, 100].map((size) => (
                                    <SelectItem key={size} value={`${size}`}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="bg-muted/30 border-b border-border hover:bg-transparent">
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="px-6 py-2 h-11">
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
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={`skeleton-${i}`} className="border-b border-border/50">
                                    {columns.map((_, j) => (
                                        <TableCell key={`cell-${i}-${j}`} className="px-6 py-4">
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className="hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="px-6 py-3.5">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground italic">
                                    {trades.length === 0
                                        ? "No trades recorded yet. Adjust parameters and run simulation."
                                        : "No trades matching your filters."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-border bg-muted/20 gap-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} of {table.getFilteredRowModel().rows.length} trades
                </div>
                <div className="flex items-center space-x-1.5">
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="h-8 w-8 rounded-lg border border-border bg-background/50 hover:bg-secondary transition-all disabled:opacity-30"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronsLeft size={14} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="h-8 w-8 rounded-lg border border-border bg-background/50 hover:bg-secondary transition-all disabled:opacity-30"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft size={14} />
                    </Button>

                    <div className="flex items-center justify-center min-w-[80px] text-[11px] font-bold bg-muted/50 h-8 rounded-lg border border-border px-3">
                        {table.getState().pagination.pageIndex + 1} <span className="mx-1 text-muted-foreground">/</span> {table.getPageCount() || 1}
                    </div>

                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="h-8 w-8 rounded-lg border border-border bg-background/50 hover:bg-secondary transition-all disabled:opacity-30"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronRight size={14} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="h-8 w-8 rounded-lg border border-border bg-background/50 hover:bg-secondary transition-all disabled:opacity-30"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronsRight size={14} />
                    </Button>
                </div>
            </div>
        </div>
    );
};

