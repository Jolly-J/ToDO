import type { Task } from '@/types';

/**
 * 将平铺的任务列表组装为树形嵌套结构（WBS Tree）。
 *
 * 1. 拥有 parent_id 且父任务存在于当前列表中的任务，自动挂载到父任务的 subtasks 数组中；
 * 2. 顶层父任务（无 parent_id，或 parent 不在当前页面列表中的孤立子任务）保留在根节点数组；
 * 3. 避免破坏任务原始属性，杜绝 emoji 符号。
 */
export function buildTaskTree(flatTasks: Task[]): Task[] {
  if (!flatTasks || flatTasks.length === 0) return [];

  const taskMap = new Map<string, Task & { subtasks: Task[] }>();
  flatTasks.forEach((task) => {
    taskMap.set(task.id, {
      ...task,
      subtasks: task.subtasks ? [...task.subtasks] : [],
    });
  });

  const roots: Task[] = [];
  flatTasks.forEach((task) => {
    const current = taskMap.get(task.id)!;
    if (task.parent_id && taskMap.has(task.parent_id)) {
      const parent = taskMap.get(task.parent_id)!;
      if (!parent.subtasks.some((st) => st.id === current.id)) {
        parent.subtasks.push(current);
      }
    } else {
      roots.push(current);
    }
  });

  return roots;
}
