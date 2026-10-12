/**
 * 组件名称：任务列表视图表格
 * 文件作用：作为任务域列表视图的统一表格入口，屏蔽通用表壳实现细节。
 * 主要功能：承接任务类页面的列表表格渲染，并为后续统一默认行为预留稳定接入点。
 * 默认排序：先按状态（待办→进行中→已完成），同状态内按截止日期降序（最近的排前面，无截止日期排最后）。
 */
import type { SortingState } from '@tanstack/react-table';
import type { Task } from '@/types';
import TaskWorkbenchTable, { type TaskWorkbenchTableProps } from '@/components/task/workbench/TaskWorkbenchTable';

export type TaskTableViewProps = TaskWorkbenchTableProps<Task>;

const DEFAULT_TASK_SORTING: SortingState = [
  { id: 'status', desc: false },
  { id: 'due_date', desc: true },
];

export default function TaskTableView(props: TaskTableViewProps) {
  return (
    <TaskWorkbenchTable<Task>
      defaultSorting={DEFAULT_TASK_SORTING}
      getSubRows={(task) => (task.subtasks && task.subtasks.length > 0 ? task.subtasks : undefined)}
      defaultExpanded={true}
      {...props}
    />
  );
}
