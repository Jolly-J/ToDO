/** 任务状态 Store，管理任务列表的 CRUD、筛选与排序状态 */
import { create } from 'zustand';
import type {
  Task,
  TaskAttachment,
  TaskStatus,
  TaskPriority,
  MyTaskScope,
  MyTaskStatusFilter,
  TaskShareResult,
  TaskShareLink,
  TaskDetailSource,
} from '@/types';
import request from '@/api/request';
import clientLogger from '@/utils/clientLogger';

type TaskView = 'list' | 'board' | 'calendar' | 'cockpit';

interface TaskFilters {
  status?: TaskStatus | MyTaskStatusFilter;
  priority?: TaskPriority;
  assignee_id?: string;
  keyword?: string;
  scope?: MyTaskScope;
  dueStartDate?: string;
  dueEndDate?: string;
}

type TeamTaskViewFilters = Partial<Record<TaskView, TaskFilters>>;

interface BoardData {
  in_progress: Task[];
  delayed_in_progress: Task[];
  done: Task[];
  delayed_done: Task[];
  canceled: Task[];
}

interface TaskDetailOptions {
  source?: TaskDetailSource;
}

interface TaskState {
  tasks: Task[];
  taskDetails: Record<string, Task>;
  boardData: BoardData;
  calendarData: { id: string; title: string; date: string; priority: TaskPriority; status: TaskStatus }[];
  total: number;
  myTaskSummary: Record<MyTaskScope, number>;
  loading: boolean;
  cancelCollectionFetch: () => void;
  currentView: TaskView;
  filters: TaskFilters;
  filtersByView: TeamTaskViewFilters;
  activeTeamId: string | null;
  fetchTasks: (teamId: string) => Promise<void>;
  fetchTaskDetail: (taskId: string, options?: TaskDetailOptions) => Promise<Task>;
  fetchMyTasks: (filters?: TaskFilters) => Promise<void>;
  fetchTrashTasks: (filters?: Pick<TaskFilters, 'keyword'>) => Promise<void>;
  shareTask: (taskId: string, receiverIds?: string[]) => Promise<TaskShareResult>;
  getTaskShareLink: (taskId: string) => Promise<TaskShareLink>;
  uploadTaskAttachments: (taskId: string, files: File[]) => Promise<TaskAttachment[]>;
  deleteTaskAttachment: (taskId: string, attachmentId: string) => Promise<void>;
  createTask: (data: Partial<Task> & { attachment_ids?: string[] }) => Promise<Task>;
  createSubtask: (parentId: string, data: Partial<Task>) => Promise<Task>;
  fetchSubtasks: (taskId: string) => Promise<{ list: Task[]; subtask_count: number; subtask_done_count: number }>;
  updateTask: (taskId: string, data: Partial<Task>) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus, sort_order?: number) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  restoreTask: (taskId: string) => Promise<void>;
  setFilters: (filters: TaskFilters) => void;
  setViewFilters: (view: TaskView, filters: TaskFilters) => void;
  setView: (view: TaskView) => void;
  getTaskById: (taskId: string) => Task | undefined;
}

function removeTaskFromBoardData(boardData: BoardData, taskId: string): BoardData {
  return {
    in_progress: boardData.in_progress.filter((task) => task.id !== taskId),
    delayed_in_progress: boardData.delayed_in_progress.filter((task) => task.id !== taskId),
    done: boardData.done.filter((task) => task.id !== taskId),
    delayed_done: boardData.delayed_done.filter((task) => task.id !== taskId),
    canceled: boardData.canceled.filter((task) => task.id !== taskId),
  };
}

function mapBoardData(boardData: BoardData, mapper: (task: Task) => Task): BoardData {
  return {
    in_progress: boardData.in_progress.map(mapper),
    delayed_in_progress: boardData.delayed_in_progress.map(mapper),
    done: boardData.done.map(mapper),
    delayed_done: boardData.delayed_done.map(mapper),
    canceled: boardData.canceled.map(mapper),
  };
}

function updateTaskCollections(taskId: string, updater: (task: Task) => Task) {
  const { tasks, taskDetails, boardData } = useTaskStore.getState();

  useTaskStore.setState({
    tasks: tasks.map((task) => (task.id === taskId ? updater(task) : task)),
    taskDetails: taskDetails[taskId]
      ? {
          ...taskDetails,
          [taskId]: updater(taskDetails[taskId]),
        }
      : taskDetails,
    boardData: mapBoardData(boardData, (task) => (task.id === taskId ? updater(task) : task)),
  });
}

// 所有共享集合使用同一请求序号，覆盖团队、我的任务和回收站切换。
let collectionRequest = 0;
let collectionController: AbortController | undefined;

function invalidateCollectionRequest() {
  collectionRequest++;
  collectionController?.abort();
  collectionController = undefined;
}

function beginCollectionRequest() {
  invalidateCollectionRequest();
  collectionController = new AbortController();
  return { requestId: collectionRequest, signal: collectionController.signal };
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  taskDetails: {},
  boardData: { in_progress: [], delayed_in_progress: [], done: [], delayed_done: [], canceled: [] },
  calendarData: [],
  total: 0,
  myTaskSummary: { all: 0, assigned: 0, participating: 0, created: 0, shared: 0 },
  loading: false,
  cancelCollectionFetch: () => {
    invalidateCollectionRequest();
    set({ loading: false });
  },
  currentView: 'list',
  filters: {},
  filtersByView: {
    list: {},
    board: {},
    calendar: {},
    cockpit: {},
  },
  activeTeamId: null,

  fetchTasks: async (teamId) => {
    const { requestId, signal } = beginCollectionRequest();
    if (!teamId) {
      set({ loading: false });
      return;
    }

    set({ loading: true });
    set({ activeTeamId: teamId });
    const { currentView, filtersByView } = get();
    const filters = filtersByView[currentView] || {};
    const isCurrent = () => requestId === collectionRequest && get().currentView === currentView && get().filtersByView[currentView] === filtersByView[currentView];
    const params = new URLSearchParams();
    const viewParam = currentView === 'cockpit' || currentView === 'list' ? 'list' : currentView;
    params.append('view', viewParam);
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.assignee_id) params.append('assignee_id', filters.assignee_id);
    if (filters.keyword) params.append('keyword', filters.keyword);
    if (filters.dueStartDate) params.append('due_start_date', filters.dueStartDate);
    if (filters.dueEndDate) params.append('due_end_date', filters.dueEndDate);

    try {
      if (currentView === 'board') {
        const boardData = await request.get<BoardData>(`/teams/${teamId}/tasks?${params.toString()}`, { signal });
        if (isCurrent()) set({ boardData, loading: false });
      } else if (currentView === 'calendar') {
        const calendarData = await request.get<{ id: string; title: string; date: string; priority: TaskPriority; status: TaskStatus }[]>(`/teams/${teamId}/tasks?${params.toString()}`, { signal });
        if (isCurrent()) set({ calendarData, loading: false });
      } else {
        const data = await request.get<{ list: Task[]; total: number }>(`/teams/${teamId}/tasks?${params.toString()}`, { signal });
        if (isCurrent()) set({ tasks: data.list, total: data.total, loading: false });
      }
    } catch {
      if (isCurrent()) set({ loading: false });
    }
  },

  fetchTaskDetail: async (taskId, options) => {
    const endpoint = options?.source === 'trash' ? `/tasks/trash/${taskId}` : `/tasks/${taskId}`;
    const task = await request.get<Task>(endpoint);
    const { tasks, taskDetails, boardData } = get();

    set({
      taskDetails: {
        ...taskDetails,
        [taskId]: task,
      },
      tasks: tasks.some((item) => item.id === taskId)
        ? tasks.map((item) => (item.id === taskId ? { ...item, ...task } : item))
        : tasks,
      boardData: {
        in_progress: boardData.in_progress.map((item) => (item.id === taskId ? { ...item, ...task } : item)),
        delayed_in_progress: boardData.delayed_in_progress.map((item) => (item.id === taskId ? { ...item, ...task } : item)),
        done: boardData.done.map((item) => (item.id === taskId ? { ...item, ...task } : item)),
        delayed_done: boardData.delayed_done.map((item) => (item.id === taskId ? { ...item, ...task } : item)),
        canceled: boardData.canceled.map((item) => (item.id === taskId ? { ...item, ...task } : item)),
      },
    });

    return task;
  },

  fetchMyTasks: async (filters) => {
    const { requestId, signal } = beginCollectionRequest();
    set({ loading: true });
    set({ activeTeamId: null });
    const params = new URLSearchParams();
    params.append('scope', filters?.scope || 'all');
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.keyword) params.append('keyword', filters.keyword);
    if (filters?.dueStartDate) params.append('due_start_date', filters.dueStartDate);
    if (filters?.dueEndDate) params.append('due_end_date', filters.dueEndDate);

    try {
      const data = await request.get<{
        list: Task[];
        total: number;
        summary: Record<MyTaskScope, number>;
      }>(`/my-tasks?${params.toString()}`, { signal });
      if (requestId === collectionRequest) set({ tasks: data.list, total: data.total, myTaskSummary: data.summary, loading: false });
    } catch {
      if (requestId === collectionRequest) set({ loading: false });
    }
  },

  fetchTrashTasks: async (filters) => {
    const { requestId, signal } = beginCollectionRequest();
    set({ loading: true, activeTeamId: null });
    const params = new URLSearchParams();
    if (filters?.keyword) params.append('keyword', filters.keyword);

    try {
      const data = await request.get<{ list: Task[]; total: number }>(
        `/tasks/trash${params.toString() ? `?${params.toString()}` : ''}`, { signal }
      );
      if (requestId !== collectionRequest) return;
      set({
        tasks: data.list,
        total: data.total,
        boardData: { in_progress: [], delayed_in_progress: [], done: [], delayed_done: [], canceled: [] },
        calendarData: [],
        loading: false,
      });
    } catch {
      if (requestId === collectionRequest) set({ loading: false });
    }
  },

  shareTask: async (taskId, receiverIds = []) => (
    request.post<TaskShareResult>(`/tasks/${taskId}/share`, { receiverIds })
  ),

  getTaskShareLink: async (taskId: string) => (
    request.get<TaskShareLink>(`/tasks/${taskId}/share-link`)
  ),

  uploadTaskAttachments: async (taskId, files) => {
    if (!files.length) {
      return [];
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const result = await request.post<{ attachments: TaskAttachment[]; attachment_count: number }>(
      `/tasks/${taskId}/attachments`,
      formData
    );

    updateTaskCollections(taskId, (task) => ({
      ...task,
      attachments: [...(task.attachments || []), ...result.attachments],
      attachment_count: result.attachment_count,
    }));

    return result.attachments;
  },

  deleteTaskAttachment: async (taskId, attachmentId) => {
    await request.delete(`/attachments/${attachmentId}`);

    updateTaskCollections(taskId, (task) => {
      const nextAttachments = (task.attachments || []).filter((attachment) => attachment.id !== attachmentId);
      const currentCount = task.attachment_count ?? task.attachments?.length ?? 0;

      return {
        ...task,
        attachments: nextAttachments,
        attachment_count: Math.max(
          task.attachments ? nextAttachments.length : currentCount - 1,
          0
        ),
      };
    });
  },

  createTask: async (data) => {
    const startTime = Date.now();
    try {
      const task = await request.post<Task>('/tasks', data);
      const { tasks, currentView, activeTeamId, total } = get();

      if (currentView === 'list' && activeTeamId && task.team_id === activeTeamId) {
        set({ tasks: [task, ...tasks], total: total + 1 });
      }

      if (data.parent_id) {
        const { taskDetails } = get();
        const parent = taskDetails[data.parent_id];
        if (parent) {
          const currentSubtasks = parent.subtasks || [];
          const isDone = task.status === 'done' || task.status === 'delayed_done';
          set({
            taskDetails: {
              ...taskDetails,
              [data.parent_id]: {
                ...parent,
                subtasks: [...currentSubtasks, task],
                subtask_count: (parent.subtask_count || 0) + 1,
                subtask_done_count: (parent.subtask_done_count || 0) + (isDone ? 1 : 0),
              },
            },
          });
        }
      }

      // 日志上报：任务创建成功
      clientLogger.success('frontend.task.create.success', {
        taskId: task.id,
        durationMs: Date.now() - startTime,
        meta: { title: task.title },
      });

      return task;
    } catch (err) {
      // 日志上报：任务创建失败
      clientLogger.failed('frontend.task.create.failed', {
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err : new Error('任务创建失败'),
      });
      throw err;
    }
  },

  createSubtask: async (parentId, data) => {
    const subtask = await request.post<Task>('/tasks', {
      ...data,
      parent_id: parentId,
    });
    const { taskDetails } = get();
    const parent = taskDetails[parentId];
    if (parent) {
      const currentSubtasks = parent.subtasks || [];
      const updatedSubtasks = [...currentSubtasks, subtask];
      const newCount = (parent.subtask_count || 0) + 1;
      const isDone = subtask.status === 'done' || subtask.status === 'delayed_done';
      const newDoneCount = (parent.subtask_done_count || 0) + (isDone ? 1 : 0);
      set({
        taskDetails: {
          ...taskDetails,
          [parentId]: {
            ...parent,
            subtasks: updatedSubtasks,
            subtask_count: newCount,
            subtask_done_count: newDoneCount,
          },
        },
      });
    }
    return subtask;
  },

  fetchSubtasks: async (taskId) => {
    const result = await request.get<{ list: Task[]; subtask_count: number; subtask_done_count: number }>(`/tasks/${taskId}/subtasks`);
    const { taskDetails } = get();
    const parent = taskDetails[taskId];
    if (parent) {
      set({
        taskDetails: {
          ...taskDetails,
          [taskId]: {
            ...parent,
            subtasks: result.list,
            subtask_count: result.subtask_count,
            subtask_done_count: result.subtask_done_count,
          },
        },
      });
    }
    return result;
  },

  updateTask: async (taskId, data) => {
    const startTime = Date.now();
    try {
      const task = await request.patch<Task>(`/tasks/${taskId}`, data);
      const { tasks, taskDetails, boardData } = get();
      set({
        taskDetails: {
          ...taskDetails,
          [taskId]: task,
        },
        tasks: tasks.map(t => (t.id === taskId ? { ...t, ...task } : t)),
        boardData: {
          in_progress: boardData.in_progress.map(t => (t.id === taskId ? { ...t, ...task } : t)),
          delayed_in_progress: boardData.delayed_in_progress.map(t => (t.id === taskId ? { ...t, ...task } : t)),
          done: boardData.done.map(t => (t.id === taskId ? { ...t, ...task } : t)),
          delayed_done: boardData.delayed_done.map(t => (t.id === taskId ? { ...t, ...task } : t)),
          canceled: boardData.canceled.map(t => (t.id === taskId ? { ...t, ...task } : t)),
        },
      });

      // 日志上报：任务更新成功
      clientLogger.success('frontend.task.update.success', {
        taskId,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      // 日志上报：任务更新失败
      clientLogger.failed('frontend.task.update.failed', {
        taskId,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err : new Error('任务更新失败'),
      });
      throw err;
    }
  },

  updateTaskStatus: async (taskId, status, sort_order) => {
    const task = await request.patch<Task>(`/tasks/${taskId}/status`, { status, sort_order });
    const { tasks, taskDetails, currentView, activeTeamId } = get();

    if (currentView === 'board' && activeTeamId) {
      set({
        taskDetails: {
          ...taskDetails,
          [taskId]: task,
        },
      });
      await get().fetchTasks(activeTeamId);
    } else {
      set({
        taskDetails: {
          ...taskDetails,
          [taskId]: task,
        },
        tasks: tasks.map(t => (t.id === taskId ? { ...t, ...task } : t)),
      });
    }
  },

  deleteTask: async (taskId) => {
    const startTime = Date.now();
    try {
      await request.delete(`/tasks/${taskId}`);
      const { tasks, taskDetails, boardData, calendarData, total } = get();
      const nextTaskDetails = { ...taskDetails };
      delete nextTaskDetails[taskId];
      set({
        taskDetails: nextTaskDetails,
        tasks: tasks.filter((task) => task.id !== taskId),
        boardData: removeTaskFromBoardData(boardData, taskId),
        calendarData: calendarData.filter((task) => task.id !== taskId),
        total: Math.max(total - 1, 0),
      });

      // 日志上报：任务删除成功
      clientLogger.success('frontend.task.delete.success', {
        taskId,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      // 日志上报：任务删除失败
      clientLogger.failed('frontend.task.delete.failed', {
        taskId,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err : new Error('任务删除失败'),
      });
      throw err;
    }
  },

  restoreTask: async (taskId) => {
    await request.patch(`/tasks/trash/${taskId}/restore`);
    const { tasks, taskDetails, total } = get();
    const nextTaskDetails = { ...taskDetails };
    delete nextTaskDetails[taskId];
    set({
      taskDetails: nextTaskDetails,
      tasks: tasks.filter((task) => task.id !== taskId),
      total: Math.max(total - 1, 0),
    });
  },

  setFilters: (filters) => {
    invalidateCollectionRequest();
    set((state) => ({
      loading: false,
      filters,
      filtersByView: {
        ...state.filtersByView,
        [state.currentView]: filters,
      },
    }));
  },
  setViewFilters: (view, filters) => {
    if (get().currentView === view) invalidateCollectionRequest();
    set((state) => ({
      loading: state.currentView === view ? false : state.loading,
      filters: state.currentView === view ? filters : state.filters,
      filtersByView: {
        ...state.filtersByView,
        [view]: filters,
      },
    }));
  },
  setView: (view) => {
    invalidateCollectionRequest();
    set((state) => ({
      loading: false,
      currentView: view,
      filters: state.filtersByView[view] || {},
    }));
  },

  getTaskById: (taskId) => {
    const { tasks, taskDetails, boardData } = get();
    return (
      tasks.find(t => t.id === taskId) ||
      boardData.in_progress.find(t => t.id === taskId) ||
      boardData.delayed_in_progress.find(t => t.id === taskId) ||
      boardData.done.find(t => t.id === taskId) ||
      boardData.delayed_done.find(t => t.id === taskId) ||
      boardData.canceled.find(t => t.id === taskId) ||
      taskDetails[taskId]
    );
  },
}));
