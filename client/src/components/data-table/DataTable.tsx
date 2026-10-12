/**
 * 通用数据表格组件
 * 基于 @tanstack/react-table 封装，支持分页、排序、行选择等功能
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  type ColumnDef,
  type ExpandedState,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import DataTableColumnHeader from './DataTableColumnHeader';
import DataTablePagination from './DataTablePagination';
import {
  type DataTableLocale,
  zhCNDataTableLocale,
} from './data-table-locale';

export interface DataTablePaginationConfig {
  total?: number;
  pageSize?: number;
  /** 受控页码，使用 TanStack Table 的 0 起始索引 */
  pageIndex?: number;
  onPageIndexChange?: (pageIndex: number) => void;
}

export interface DataTableProps<TData extends object> {
  className?: string;
  columns: Array<ColumnDef<TData, unknown>>;
  data: TData[];
  defaultSorting?: SortingState;
  emptyText?: ReactNode;
  loading?: boolean;
  locale?: Partial<DataTableLocale>;
  onRow?: (record: TData) => {
    onClick?: React.MouseEventHandler<HTMLTableRowElement>;
  };
  pagination?: DataTablePaginationConfig;
  rowKey: keyof TData | ((record: TData) => string);
  selectedCount?: number;
  getSubRows?: (row: TData) => TData[] | undefined;
  defaultExpanded?: boolean | ExpandedState;
}

const DEFAULT_PAGE_SIZE = 20;

const getPageSizeOptions = (pageSize: number) =>
  Array.from(new Set([10, 20, 30, 40, 50, pageSize]))
    .sort((left, right) => left - right)
    .map((value) => String(value));

function getRowKey<TData extends object>(
  row: TData,
  rowKey: keyof TData | ((record: TData) => string)
) {
  if (typeof rowKey === 'function') {
    return rowKey(row);
  }

  return String(row[rowKey]);
}

function DataTable<TData extends object>({
  className,
  columns,
  data,
  defaultSorting,
  emptyText = '暂无数据',
  loading = false,
  locale,
  onRow,
  pagination,
  rowKey,
  selectedCount = 0,
  getSubRows,
  defaultExpanded,
}: DataTableProps<TData>) {
  const initialPageSize = pagination?.pageSize || DEFAULT_PAGE_SIZE;
  const [sorting, setSorting] = useState<SortingState>(defaultSorting ?? []);
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    if (defaultExpanded === false) return {};
    if (defaultExpanded === true || defaultExpanded === undefined) return true;
    return defaultExpanded;
  });
  const [paginationState, setPaginationState] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const controlledPageIndex = pagination?.pageIndex;
  const effectivePaginationState: PaginationState = {
    pageIndex: controlledPageIndex ?? paginationState.pageIndex,
    pageSize: paginationState.pageSize,
  };

  useEffect(() => {
    setPaginationState((current) => {
      if (current.pageSize === initialPageSize) {
        return current;
      }

      return {
        pageIndex: 0,
        pageSize: initialPageSize,
      };
    });
  }, [initialPageSize]);

  const rowCount = data.length;
  const totalCount = pagination?.total ?? rowCount;
  const localeText = useMemo(
    () => ({ ...zhCNDataTableLocale, ...locale }),
    [locale]
  );
  const pageSizeOptions = useMemo(
    () => getPageSizeOptions(paginationState.pageSize),
    [paginationState.pageSize]
  );

  const table = useReactTable({
    autoResetPageIndex: false,
    columns,
    data,
    getSubRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (originalRow) => getRowKey(originalRow, rowKey),
    onExpandedChange: setExpanded,
    onPaginationChange: (updater) => {
      const nextState = typeof updater === 'function'
        ? updater(effectivePaginationState)
        : updater;

      if (controlledPageIndex !== undefined) {
        if (nextState.pageIndex !== effectivePaginationState.pageIndex) {
          pagination?.onPageIndexChange?.(nextState.pageIndex);
        }
        setPaginationState((current) => ({
          ...current,
          pageSize: nextState.pageSize,
        }));
        return;
      }

      setPaginationState(nextState);
    },
    onSortingChange: setSorting,
    state: {
      pagination: effectivePaginationState,
      sorting,
      expanded,
    },
  });

  useEffect(() => {
    const pageCount = table.getPageCount();
    if (paginationState.pageIndex >= pageCount && pageCount > 0) {
      table.setPageIndex(pageCount - 1);
    }
  }, [effectivePaginationState.pageIndex, rowCount, table]);

  return (
    <div className={cn('flex flex-col gap-[var(--tf-density-workspace-gap)]', className)}>
      <div className="overflow-hidden rounded-md border">
        <Table style={{ tableLayout: 'fixed' }}>
          <TableHeader data-tour="my-tasks-table-header team-workspace-table-header trash-table-header workbench-table-header">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const headerSize = header.getSize();

                  return (
                    <TableHead
                      key={header.id}
                      style={headerSize ? { width: headerSize } : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <DataTableColumnHeader
                          column={header.column}
                          title={flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        />
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={table.getAllColumns().length}
                >
                  {localeText.loading}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const rowProps = onRow?.(row.original);

                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      rowProps?.onClick && 'cursor-pointer',
                      row.depth > 0 && 'bg-[#FAFAFA]/70 hover:bg-[#F3F4F6]/80'
                    )}
                    onClick={rowProps?.onClick}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const cellSize = cell.column.getSize();
                      return (
                        <TableCell
                          key={cell.id}
                          style={cellSize ? { width: cellSize } : undefined}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={table.getAllColumns().length}
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination
        canNextPage={table.getCanNextPage()}
        canPreviousPage={table.getCanPreviousPage()}
        locale={localeText}
        pageCount={table.getPageCount()}
        pageIndex={table.getState().pagination.pageIndex}
        pageSize={paginationState.pageSize}
        pageSizeOptions={pageSizeOptions}
        selectedCount={selectedCount}
        totalCount={totalCount}
        onNextPage={() => table.nextPage()}
        onPageIndexChange={(pageIndex) => table.setPageIndex(pageIndex)}
        onPageSizeChange={(pageSize) => {
          table.setPageSize(pageSize);
          table.setPageIndex(0);
        }}
        onPreviousPage={() => table.previousPage()}
      />
    </div>
  );
}

export default DataTable;
