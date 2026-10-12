/**
 * 组件名称：任务工作台表格
 * 文件作用：为任务类页面提供统一的表格骨架和固定布局能力。
 * 主要功能：封装任务表格外壳、分页、排序与测试锚点，复用在我的任务和团队空间列表视图中。
 */
import type { MouseEventHandler, ReactNode } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import DataTable, {
  type DataTablePaginationConfig,
} from '@/components/data-table/DataTable';
import TaskWorkbenchSurface from './TaskWorkbenchSurface';
import styles from './TaskWorkbenchTable.module.css';

export interface TaskWorkbenchTableProps<RecordType extends object> {
  className?: string;
  columns: Array<ColumnDef<RecordType, unknown>>;
  dataSource: RecordType[];
  defaultSorting?: SortingState;
  loading?: boolean;
  locale?: {
    emptyText?: ReactNode;
  };
  onRow?: (record: RecordType) => {
    onClick?: MouseEventHandler<HTMLTableRowElement>;
  };
  pagination?: DataTablePaginationConfig;
  rowKey: keyof RecordType | ((record: RecordType) => string);
  surfaceClassName?: string;
  surfaceTestId?: string;
  getSubRows?: (row: RecordType) => RecordType[] | undefined;
  defaultExpanded?: boolean;
}

export default function TaskWorkbenchTable<RecordType extends object>({
  className,
  columns,
  dataSource,
  defaultSorting,
  loading,
  locale,
  onRow,
  pagination,
  rowKey,
  surfaceClassName,
  surfaceTestId,
  getSubRows,
  defaultExpanded,
}: TaskWorkbenchTableProps<RecordType>) {
  return (
    <TaskWorkbenchSurface
      testId={surfaceTestId}
      className={`${styles.shell} ${surfaceClassName || ''}`.trim()}
    >
      <DataTable<RecordType>
        className={className}
        columns={columns}
        data={dataSource}
        defaultSorting={defaultSorting}
        emptyText={locale?.emptyText}
        loading={loading}
        onRow={onRow}
        pagination={pagination}
        rowKey={rowKey}
        getSubRows={getSubRows}
        defaultExpanded={defaultExpanded}
      />
    </TaskWorkbenchSurface>
  );
}
