/**
 * 数据表格分页控件
 * 提供每页条数选择、页码导航（首页/上一页/下一页/末页）
 */
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DataTableLocale } from './data-table-locale';

interface DataTablePaginationProps {
  locale: DataTableLocale;
  onPageSizeChange: (pageSize: number) => void;
  onPageIndexChange: (pageIndex: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  pageCount: number;
  pageIndex: number;
  pageSize: number;
  pageSizeOptions: string[];
  selectedCount: number;
  totalCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
}

export default function DataTablePagination({
  locale,
  onPageSizeChange,
  onPageIndexChange,
  onPreviousPage,
  onNextPage,
  pageCount,
  pageIndex,
  pageSize,
  pageSizeOptions,
  selectedCount,
  totalCount,
  canPreviousPage,
  canNextPage,
}: DataTablePaginationProps) {
  const displayPageCount = pageCount === 0 ? 0 : pageCount;
  const displayPageIndex = pageCount === 0 ? 0 : pageIndex + 1;

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex-1 text-sm text-muted-foreground">
        {locale.formatSelectedCount(selectedCount, totalCount)}
      </div>

      <div className="flex items-center gap-[var(--tf-density-toolbar-gap)] lg:gap-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{locale.rowsPerPage}</p>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-[var(--tf-density-button-height-sm)] w-[80px] rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-[112px] items-center justify-center text-sm font-medium">
          {locale.formatPageInfo(displayPageIndex, displayPageCount)}
        </div>

        <div className="flex items-center gap-2">
          <Button
            aria-label={locale.firstPage}
            className="hidden lg:flex"
            disabled={!canPreviousPage}
            size="icon-sm"
            variant="outline"
            onClick={() => onPageIndexChange(0)}
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            aria-label={locale.previousPage}
            disabled={!canPreviousPage}
            size="icon-sm"
            variant="outline"
            onClick={onPreviousPage}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label={locale.nextPage}
            disabled={!canNextPage}
            size="icon-sm"
            variant="outline"
            onClick={onNextPage}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            aria-label={locale.lastPage}
            className="hidden lg:flex"
            disabled={!canNextPage}
            size="icon-sm"
            variant="outline"
            onClick={() => onPageIndexChange(Math.max(pageCount - 1, 0))}
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
