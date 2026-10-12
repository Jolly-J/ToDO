/**
 * 数据表格列头组件
 * 提供可点击的排序交互，显示升序/降序/未排序状态图标
 */
import type { Column } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DataTableColumnHeaderProps<TData, TValue> {
  className?: string;
  column: Column<TData, TValue>;
  title: ReactNode;
}

export default function DataTableColumnHeader<TData, TValue>({
  className,
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  const sortDirection = column.getIsSorted();
  const handleToggleSorting = () => {
    if (sortDirection === false) {
      column.toggleSorting(false, true);
      return;
    }

    if (sortDirection === 'asc') {
      column.toggleSorting(true, true);
      return;
    }

    column.clearSorting();
  };

  return (
    <Button
      aria-label={typeof title === 'string' ? title : undefined}
      className={cn('-ml-2 h-[var(--tf-density-button-height-sm)] w-full justify-start px-[var(--tf-density-button-padding-x-sm)]', className)}
      size="sm"
      type="button"
      variant="ghost"
      onClick={handleToggleSorting}
    >
      <span>{title}</span>
      {sortDirection === 'asc' ? (
        <ArrowUp className="size-4" />
      ) : sortDirection === 'desc' ? (
        <ArrowDown className="size-4" />
      ) : (
        <ChevronsUpDown className="size-4" />
      )}
    </Button>
  );
}
