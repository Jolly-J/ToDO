/**
 * 多看板任务管理状态管理
 * 基于 Zustand 管理多看板模式下的任务列表、筛选、排序及看板配置状态
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type { 
  ExtendedTask, 
  BoardConfiguration, 
  BoardMode, 
  TaskLevel, 
  TaskFilters, 
  TaskStatus,
  LoadingState,
  DragError,
  SyncOperation,
  TaskRelation,
  TaskDependency,
  TaskCollaborator,
  TaskHierarchy,
  TaskPermissions,
  PermissionLevel
} from '@/types/multi-board';

// ===== 任务状态管理接口 =====
interface TaskStore {
  // 状态
  tasks: ExtendedTask[];
  boardConfig: BoardConfiguration | null;
  currentView: BoardMode;
  currentLevel: TaskLevel;
  filters: TaskFilters;
  loading: LoadingState;
  error: string | null;
  
  // 拖拽状态
  activeTask: ExtendedTask | null;
  dragError: DragError | null;
  
  // 同步队列
  syncQueue: SyncOperation[];
  
  // 乐观更新备份
  optimisticBackups: Map<string, ExtendedTask>;
  
  // 自动保存定时器
  autoSaveTimers: Map<string, number>;
  
  // 操作方法
  fetchTasks: (teamId: string, level?: TaskLevel) => Promise<void>;
  createTask: (task: Partial<ExtendedTask>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<ExtendedTask>) => Promise<void>;
  moveTask: (taskId: string, newStatus: TaskStatus, newLevel?: TaskLevel) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  
  // 视图操作
  setView: (view: BoardMode) => void;
  setLevel: (level: TaskLevel) => void;
  setFilters: (filters: Partial<TaskFilters>) => void;
  clearFilters: () => void;
  
  // 看板配置
  updateBoardConfig: (config: Partial<BoardConfiguration>) => void;
  addColumn: (column: Omit<BoardConfiguration['columns'][0], 'id'>) => void;
  removeColumn: (columnId: string) => void;
  reorderColumns: (columnIds: string[]) => void;
  
  // 拖拽操作
  setActiveTask: (task: ExtendedTask | null) => void;
  setDragError: (error: DragError | null) => void;
  
  // 乐观更新
  optimisticUpdateTask: (taskId: string, updates: Partial<ExtendedTask>) => void;
  rollbackOptimisticUpdate: (taskId: string) => void;
  
  // 同步操作
  addToSyncQueue: (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>) => void;
  processSyncQueue: () => Promise<void>;
  
  // 任务关联关系管理
  addTaskRelation: (relation: Omit<TaskRelation, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
  removeTaskRelation: (relationId: string) => Promise<void>;
  getTaskRelations: (taskId: string) => TaskRelation[];
  
  // 任务依赖管理
  addTaskDependency: (taskId: string, dependency: Omit<TaskDependency, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
  removeDependency: (taskId: string, dependencyId: string) => Promise<void>;
  updateDependencyStatus: (dependencyId: string, status: TaskDependency['status']) => Promise<void>;
  
  // 协作者管理
  addCollaborator: (taskId: string, collaborator: Omit<TaskCollaborator, 'joinedAt'>) => Promise<void>;
  removeCollaborator: (taskId: string, userId: string) => Promise<void>;
  updateCollaboratorRole: (taskId: string, userId: string, role: TaskCollaborator['role']) => Promise<void>;
  updateCollaboratorPermissions: (taskId: string, userId: string, permissions: PermissionLevel[]) => Promise<void>;
  
  // 任务层级管理
  changeTaskLevel: (taskId: string, newLevel: TaskLevel, newParentId?: string) => Promise<void>;
  getTaskHierarchy: (taskId: string) => TaskHierarchy | undefined;
  canMoveTaskToLevel: (taskId: string, targetLevel: TaskLevel) => boolean;
  
  // 权限检查
  checkTaskPermission: (taskId: string, userId: string, permission: keyof TaskPermissions) => boolean;
  getUserTaskPermissions: (taskId: string, userId: string) => TaskPermissions | undefined;
  // 工具方法
  getTaskById: (taskId: string) => ExtendedTask | undefined;
  getTasksByStatus: (status: TaskStatus) => ExtendedTask[];
  getTasksByLevel: (level: TaskLevel) => ExtendedTask[];
  getFilteredTasks: () => ExtendedTask[];
  
  // 重置状态
  reset: () => void;
}

// ===== 初始状态 =====
const initialState = {
  tasks: [],
  boardConfig: null,
  currentView: 'board' as BoardMode,
  currentLevel: 'group' as TaskLevel,
  filters: {},
  loading: {
    global: false,
    tasks: false,
    teams: false,
    dragOperation: false,
    saving: false,
  },
  error: null,
  activeTask: null,
  dragError: null,
  syncQueue: [],
  optimisticBackups: new Map(),
  autoSaveTimers: new Map(),
};

interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'code' in value &&
    'data' in value
  );
}

async function readApiData<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json();

  if (!response.ok) {
    if (isApiEnvelope<unknown>(payload) && payload.message) {
      throw new Error(payload.message);
    }

    throw new Error(fallbackMessage);
  }

  if (isApiEnvelope<T>(payload)) {
    if (payload.code !== 0) {
      throw new Error(payload.message || fallbackMessage);
    }

    return payload.data;
  }

  return payload as T;
}

// ===== 创建任务状态管理 =====
export const useTaskStore = create<TaskStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,
      
      // ===== 数据获取 =====
      fetchTasks: async (teamId: string, level?: TaskLevel) => {
        set((state) => ({
          loading: { ...state.loading, tasks: true },
          error: null,
        }));
        
        try {
          const response = await fetch(`/api/teams/${teamId}/tasks?level=${level || get().currentLevel}`);
          const data = await readApiData<ExtendedTask[] | { list: ExtendedTask[] }>(response, '获取任务失败');
          const tasks = Array.isArray(data) ? data : data.list;
          
          set({
            tasks,
            loading: { ...get().loading, tasks: false },
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '获取任务失败',
            loading: { ...get().loading, tasks: false },
          });
        }
      },
      
      createTask: async (task: Partial<ExtendedTask>) => {
        set((state) => ({
          loading: { ...state.loading, saving: true },
          error: null,
        }));
        
        try {
          // 确保新任务状态设置为"进行中"（需求 4.2）
          const newTaskData = {
            ...task,
            status: task.status || 'in_progress' as TaskStatus,
            level: task.level || get().currentLevel,
            tags: task.tags || [],
            collaborators: task.collaborators || [],
            watchers: task.watchers || [],
            mentions: task.mentions || [],
            childTaskIds: task.childTaskIds || [],
            dependencies: task.dependencies || [],
            relations: task.relations || [],
            position: task.position || {
              columnId: task.status || 'in_progress',
              order: 0,
            },
            customFields: task.customFields || {},
            timeTracking: {
              startedAt: new Date().toISOString(),
            },
          };
          
          const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTaskData),
          });
          const createdTask = await readApiData<ExtendedTask>(response, '创建任务失败');
          
          set((state) => ({
            tasks: [...state.tasks, createdTask],
            loading: { ...state.loading, saving: false },
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '创建任务失败',
            loading: { ...get().loading, saving: false },
          });
        }
      },
      
      updateTask: async (taskId: string, updates: Partial<ExtendedTask>) => {
        // 检查是否需要记录完成时间
        const currentTask = get().getTaskById(taskId);
        if (currentTask && updates.status === 'done' && currentTask.status !== 'done') {
          updates.timeTracking = {
            ...currentTask.timeTracking,
            completedAt: new Date().toISOString(),
          };
        }
        
        // 乐观更新
        get().optimisticUpdateTask(taskId, updates);
        
        // 清除之前的自动保存定时器
        const existingTimer = get().autoSaveTimers.get(taskId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        
        // 设置2秒后自动保存（需求 7.2）
        const timer = setTimeout(async () => {
          try {
            const response = await fetch(`/api/tasks/${taskId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            });
            const updatedTask = await readApiData<Partial<ExtendedTask>>(response, '更新任务失败');
            
            set((state) => {
              // 清除备份和定时器
              state.optimisticBackups.delete(taskId);
              state.autoSaveTimers.delete(taskId);
              
              return {
                tasks: state.tasks.map(task => 
                  task.id === taskId ? { ...task, ...updatedTask } : task
                ),
              };
            });
          } catch (error) {
            // 回滚乐观更新
            get().rollbackOptimisticUpdate(taskId);
            set((state) => {
              state.autoSaveTimers.delete(taskId);
              return {
                error: error instanceof Error ? error.message : '更新任务失败',
              };
            });
          }
        }, 2000);
        
        // 保存定时器引用
        set((state) => {
          state.autoSaveTimers.set(taskId, timer);
          return state;
        });
      },
      
      moveTask: async (taskId: string, newStatus: TaskStatus, newLevel?: TaskLevel) => {
        const currentTask = get().getTaskById(taskId);
        if (!currentTask) {
          set({ error: '任务不存在' });
          return;
        }
        
        const updates: Partial<ExtendedTask> = { 
          status: newStatus,
          position: {
            ...currentTask.position,
            columnId: newStatus, // 根据需求 4.3，目标列自动更新任务状态
          }
        };
        
        if (newLevel) {
          updates.level = newLevel;
        }
        
        // 如果状态变为已完成，记录完成时间（需求 4.5）
        if (newStatus === 'done' && currentTask.status !== 'done') {
          updates.timeTracking = {
            ...currentTask.timeTracking,
            completedAt: new Date().toISOString(),
          };
        }
        
        // 乐观更新
        get().optimisticUpdateTask(taskId, updates);
        
        set((state) => ({
          loading: { ...state.loading, dragOperation: true },
        }));
        
        try {
          const response = await fetch(`/api/tasks/${taskId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: newStatus,
              sort_order: currentTask.sort_order ?? currentTask.position.order,
            }),
          });
          const updatedTask = await readApiData<Partial<ExtendedTask>>(response, '移动任务失败');
          
          set((state) => ({
            tasks: state.tasks.map(task => 
              task.id === taskId ? { ...task, ...updatedTask } : task
            ),
            loading: { ...state.loading, dragOperation: false },
            dragError: null,
          }));
        } catch (error) {
          // 回滚乐观更新
          get().rollbackOptimisticUpdate(taskId);
          
          const dragError: DragError = {
            type: 'network_error',
            message: error instanceof Error ? error.message : '移动任务失败',
          };
          
          set({
            dragError,
            loading: { ...get().loading, dragOperation: false },
          });
        }
      },
      
      deleteTask: async (taskId: string) => {
        set((state) => ({
          loading: { ...state.loading, saving: true },
          error: null,
        }));
        
        try {
          const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE',
          });
          await readApiData(response, '删除任务失败');
          
          set((state) => ({
            tasks: state.tasks.filter(task => task.id !== taskId),
            loading: { ...state.loading, saving: false },
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '删除任务失败',
            loading: { ...get().loading, saving: false },
          });
        }
      },
      
      // ===== 视图操作 =====
      setView: (view: BoardMode) => {
        set({ currentView: view });
      },
      
      setLevel: (level: TaskLevel) => {
        set({ currentLevel: level });
      },
      
      setFilters: (filters: Partial<TaskFilters>) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },
      
      clearFilters: () => {
        set({ filters: {} });
      },
      
      // ===== 看板配置 =====
      updateBoardConfig: (config: Partial<BoardConfiguration>) => {
        set((state) => ({
          boardConfig: state.boardConfig 
            ? { ...state.boardConfig, ...config }
            : null,
        }));
      },
      
      addColumn: (column: Omit<BoardConfiguration['columns'][0], 'id'>) => {
        const newColumn = {
          ...column,
          id: `column-${Date.now()}`,
        };
        
        set((state) => ({
          boardConfig: state.boardConfig
            ? {
                ...state.boardConfig,
                columns: [...state.boardConfig.columns, newColumn],
              }
            : null,
        }));
      },
      
      removeColumn: (columnId: string) => {
        set((state) => ({
          boardConfig: state.boardConfig
            ? {
                ...state.boardConfig,
                columns: state.boardConfig.columns.filter(col => col.id !== columnId),
              }
            : null,
        }));
      },
      
      reorderColumns: (columnIds: string[]) => {
        set((state) => {
          if (!state.boardConfig) return state;
          
          const reorderedColumns = columnIds.map((id, index) => {
            const column = state.boardConfig!.columns.find(col => col.id === id);
            return column ? { ...column, order: index } : null;
          }).filter(Boolean) as BoardConfiguration['columns'];
          
          return {
            boardConfig: {
              ...state.boardConfig,
              columns: reorderedColumns,
            },
          };
        });
      },
      
      // ===== 拖拽操作 =====
      setActiveTask: (task: ExtendedTask | null) => {
        set({ activeTask: task });
      },
      
      setDragError: (error: DragError | null) => {
        set({ dragError: error });
      },
      
      // ===== 乐观更新 =====
      optimisticUpdateTask: (taskId: string, updates: Partial<ExtendedTask>) => {
        set((state) => {
          // 保存原始任务状态用于回滚
          const originalTask = state.tasks.find(task => task.id === taskId);
          if (originalTask && !state.optimisticBackups.has(taskId)) {
            state.optimisticBackups.set(taskId, { ...originalTask });
          }
          
          return {
            tasks: state.tasks.map(task =>
              task.id === taskId ? { ...task, ...updates } : task
            ),
          };
        });
      },
      
      rollbackOptimisticUpdate: (taskId: string) => {
        set((state) => {
          const backup = state.optimisticBackups.get(taskId);
          if (backup) {
            state.optimisticBackups.delete(taskId);
            return {
              tasks: state.tasks.map(task =>
                task.id === taskId ? backup : task
              ),
            };
          }
          return state;
        });
      },
      
      // ===== 同步操作 =====
      addToSyncQueue: (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>) => {
        const syncOperation: SyncOperation = {
          ...operation,
          id: `sync-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          retryCount: 0,
        };
        
        set((state) => ({
          syncQueue: [...state.syncQueue, syncOperation],
        }));
      },
      
      processSyncQueue: async () => {
        const { syncQueue } = get();
        if (syncQueue.length === 0) return;
        
        const processOperation = async (operation: SyncOperation) => {
          try {
            switch (operation.type) {
              case 'drag': {
                const dragData = operation.data as { status?: TaskStatus; sort_order?: number };
                await readApiData(await fetch(`/api/tasks/${operation.taskId}/status`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: dragData.status,
                    sort_order: dragData.sort_order,
                  }),
                }), '同步任务状态失败');
                break;
              }
              case 'update':
                await readApiData(await fetch(`/api/tasks/${operation.taskId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(operation.data),
                }), '同步任务更新失败');
                break;
              case 'create':
                await readApiData(await fetch('/api/tasks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(operation.data),
                }), '同步任务创建失败');
                break;
              case 'delete':
                await readApiData(await fetch(`/api/tasks/${operation.taskId}`, {
                  method: 'DELETE',
                }), '同步任务删除失败');
                break;
            }
            return true;
          } catch (error) {
            console.error('Sync operation failed:', error);
            return false;
          }
        };
        
        for (const operation of [...syncQueue]) {
          const success = await processOperation(operation);
          
          if (success) {
            // 成功后从队列中移除
            set((state) => ({
              syncQueue: state.syncQueue.filter(op => op.id !== operation.id),
            }));
          } else {
            // 增加重试次数
            if (operation.retryCount < 3) {
              set((state) => ({
                syncQueue: state.syncQueue.map(op =>
                  op.id === operation.id
                    ? { ...op, retryCount: op.retryCount + 1 }
                    : op
                ),
              }));
            } else {
              // 超过重试次数，从队列中移除并记录错误
              console.error('Sync operation failed after 3 retries:', operation);
              set((state) => ({
                syncQueue: state.syncQueue.filter(op => op.id !== operation.id),
                error: `同步操作失败: ${operation.type} ${operation.taskId}`,
              }));
            }
          }
        }
      },
      
      // ===== 任务关联关系管理 =====
      addTaskRelation: async (relation: Omit<TaskRelation, 'id' | 'createdAt' | 'createdBy'>) => {
        try {
          const newRelation: TaskRelation = {
            ...relation,
            id: `relation-${Date.now()}`,
            createdAt: new Date().toISOString(),
            createdBy: 'current-user', // TODO: 从用户状态获取
          };
          
          // TODO: 实现API调用
          const response = await fetch('/api/task-relations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRelation),
          });
          
          if (!response.ok) throw new Error('添加任务关联失败');
          
          // 更新相关任务的关联关系
          set((state) => ({
            tasks: state.tasks.map(task => {
              if (task.id === relation.fromTaskId) {
                return { ...task, relations: [...task.relations, newRelation] };
              }
              return task;
            }),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '添加任务关联失败',
          });
        }
      },
      
      removeTaskRelation: async (relationId: string) => {
        try {
          // TODO: 实现API调用
          await fetch(`/api/task-relations/${relationId}`, {
            method: 'DELETE',
          });
          
          // 从所有任务中移除该关联关系
          set((state) => ({
            tasks: state.tasks.map(task => ({
              ...task,
              relations: task.relations.filter(rel => rel.id !== relationId),
            })),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '移除任务关联失败',
          });
        }
      },
      
      getTaskRelations: (taskId: string) => {
        const task = get().getTaskById(taskId);
        return task?.relations || [];
      },
      
      // ===== 任务依赖管理 =====
      addTaskDependency: async (taskId: string, dependency: Omit<TaskDependency, 'id' | 'createdAt' | 'createdBy'>) => {
        try {
          const newDependency: TaskDependency = {
            ...dependency,
            id: `dep-${Date.now()}`,
            createdAt: new Date().toISOString(),
            createdBy: 'current-user', // TODO: 从用户状态获取
            status: 'active',
          };
          
          // TODO: 实现API调用
          const response = await fetch(`/api/tasks/${taskId}/dependencies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newDependency),
          });
          
          if (!response.ok) throw new Error('添加任务依赖失败');
          
          set((state) => ({
            tasks: state.tasks.map(task =>
              task.id === taskId
                ? { ...task, dependencies: [...task.dependencies, newDependency] }
                : task
            ),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '添加任务依赖失败',
          });
        }
      },
      
      removeDependency: async (taskId: string, dependencyId: string) => {
        try {
          // TODO: 实现API调用
          await fetch(`/api/tasks/${taskId}/dependencies/${dependencyId}`, {
            method: 'DELETE',
          });
          
          set((state) => ({
            tasks: state.tasks.map(task =>
              task.id === taskId
                ? { ...task, dependencies: task.dependencies.filter(dep => dep.id !== dependencyId) }
                : task
            ),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '移除任务依赖失败',
          });
        }
      },
      
      updateDependencyStatus: async (dependencyId: string, status: TaskDependency['status']) => {
        try {
          // TODO: 实现API调用
          await fetch(`/api/dependencies/${dependencyId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          });
          
          set((state) => ({
            tasks: state.tasks.map(task => ({
              ...task,
              dependencies: task.dependencies.map(dep =>
                dep.id === dependencyId ? { ...dep, status } : dep
              ),
            })),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '更新依赖状态失败',
          });
        }
      },
      
      // ===== 协作者管理 =====
      addCollaborator: async (taskId: string, collaborator: Omit<TaskCollaborator, 'joinedAt'>) => {
        try {
          const newCollaborator: TaskCollaborator = {
            ...collaborator,
            joinedAt: new Date().toISOString(),
            contributionHours: 0,
          };
          
          // TODO: 实现API调用
          const response = await fetch(`/api/tasks/${taskId}/collaborators`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCollaborator),
          });
          
          if (!response.ok) throw new Error('添加协作者失败');
          
          set((state) => ({
            tasks: state.tasks.map(task =>
              task.id === taskId
                ? { ...task, collaborators: [...task.collaborators, newCollaborator] }
                : task
            ),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '添加协作者失败',
          });
        }
      },
      
      removeCollaborator: async (taskId: string, userId: string) => {
        try {
          // TODO: 实现API调用
          await fetch(`/api/tasks/${taskId}/collaborators/${userId}`, {
            method: 'DELETE',
          });
          
          set((state) => ({
            tasks: state.tasks.map(task =>
              task.id === taskId
                ? { ...task, collaborators: task.collaborators.filter(c => c.userId !== userId) }
                : task
            ),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '移除协作者失败',
          });
        }
      },
      
      updateCollaboratorRole: async (taskId: string, userId: string, role: TaskCollaborator['role']) => {
        try {
          // TODO: 实现API调用
          await fetch(`/api/tasks/${taskId}/collaborators/${userId}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
          });
          
          set((state) => ({
            tasks: state.tasks.map(task =>
              task.id === taskId
                ? {
                    ...task,
                    collaborators: task.collaborators.map(c =>
                      c.userId === userId ? { ...c, role } : c
                    ),
                  }
                : task
            ),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '更新协作者角色失败',
          });
        }
      },
      
      updateCollaboratorPermissions: async (taskId: string, userId: string, permissions: PermissionLevel[]) => {
        try {
          // TODO: 实现API调用
          await fetch(`/api/tasks/${taskId}/collaborators/${userId}/permissions`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissions }),
          });
          
          set((state) => ({
            tasks: state.tasks.map(task =>
              task.id === taskId
                ? {
                    ...task,
                    collaborators: task.collaborators.map(c =>
                      c.userId === userId ? { ...c, permissions } : c
                    ),
                  }
                : task
            ),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '更新协作者权限失败',
          });
        }
      },
      
      // ===== 任务层级管理 =====
      changeTaskLevel: async (taskId: string, newLevel: TaskLevel, newParentId?: string) => {
        try {
          // TODO: 实现API调用
          const response = await fetch(`/api/tasks/${taskId}/level`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: newLevel, parentId: newParentId }),
          });
          
          if (!response.ok) throw new Error('更改任务层级失败');
          
          const levelColors = {
            company: '#1890FF',
            department: '#52C41A',
            group: '#FA8C16',
          };
          
          set((state) => ({
            tasks: state.tasks.map(task =>
              task.id === taskId
                ? {
                    ...task,
                    level: newLevel,
                    levelColor: levelColors[newLevel],
                    parentTaskId: newParentId,
                  }
                : task
            ),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '更改任务层级失败',
          });
        }
      },
      
      getTaskHierarchy: (taskId: string) => {
        // TODO: 实现层级关系查询逻辑
        const task = get().getTaskById(taskId);
        if (!task) return undefined;
        
        return {
          taskId,
          level: task.level,
          parentId: task.parentTaskId,
          childrenIds: task.childTaskIds,
          depth: task.parentTaskId ? 1 : 0, // 简化实现
          path: task.parentTaskId ? [task.parentTaskId, taskId] : [taskId],
          canMoveToLevel: task.level === 'company' ? [] : ['company', 'department', 'group'].filter(l => l !== task.level) as TaskLevel[],
        };
      },
      
      canMoveTaskToLevel: (taskId: string, targetLevel: TaskLevel) => {
        const task = get().getTaskById(taskId);
        if (!task) return false;
        
        // 公司级任务不能降级
        if (task.level === 'company' && targetLevel !== 'company') {
          return false;
        }
        
        // 检查是否有权限更改层级
        const hasPermission = get().checkTaskPermission(taskId, 'current-user', 'canChangeLevel');
        return hasPermission;
      },
      
      // ===== 权限检查 =====
      checkTaskPermission: (taskId: string, userId: string, permission: keyof TaskPermissions) => {
        // TODO: 实现权限检查逻辑
        const task = get().getTaskById(taskId);
        if (!task) return false;
        
        // 简化实现：任务创建者和负责人有所有权限
        if (task.creator_id === userId || task.assignee_id === userId) {
          return true;
        }
        
        // 检查协作者权限
        const collaborator = task.collaborators.find(c => c.userId === userId);
        if (collaborator) {
          switch (permission) {
            case 'canView':
              return collaborator.permissions.includes('view');
            case 'canEdit':
              return collaborator.permissions.includes('edit');
            case 'canDelete':
            case 'canAssign':
            case 'canChangeLevel':
            case 'canManageCollaborators':
              return collaborator.permissions.includes('manage');
            default:
              return false;
          }
        }
        
        return false;
      },
      
      getUserTaskPermissions: (taskId: string, userId: string) => {
        // TODO: 实现用户任务权限查询
        const task = get().getTaskById(taskId);
        if (!task) return undefined;
        
        const isOwner = task.creator_id === userId || task.assignee_id === userId;
        const collaborator = task.collaborators.find(c => c.userId === userId);
        
        return {
          taskId,
          userId,
          canView: true,
          canEdit: isOwner || (collaborator?.permissions.includes('edit') ?? false),
          canDelete: isOwner || (collaborator?.permissions.includes('manage') ?? false),
          canAssign: isOwner || (collaborator?.permissions.includes('manage') ?? false),
          canChangeLevel: isOwner || (collaborator?.permissions.includes('manage') ?? false),
          canManageCollaborators: isOwner || (collaborator?.permissions.includes('manage') ?? false),
          inheritedFrom: isOwner ? 'direct' : (collaborator ? 'team' : undefined),
        } as TaskPermissions;
      },
      
      // ===== 工具方法 =====
      getTaskById: (taskId: string) => {
        return get().tasks.find(task => task.id === taskId);
      },
      
      getTasksByStatus: (status: TaskStatus) => {
        return get().tasks.filter(task => task.status === status);
      },
      
      getTasksByLevel: (level: TaskLevel) => {
        return get().tasks.filter(task => task.level === level);
      },
      
      getFilteredTasks: () => {
        const { tasks, filters } = get();
        
        return tasks.filter(task => {
          // 状态过滤
          if (filters.status && filters.status.length > 0) {
            if (!filters.status.includes(task.status)) return false;
          }
          
          // 优先级过滤
          if (filters.priority && filters.priority.length > 0) {
            if (!filters.priority.includes(task.priority)) return false;
          }
          
          // 层级过滤
          if (filters.level && filters.level.length > 0) {
            if (!filters.level.includes(task.level)) return false;
          }
          
          // 负责人过滤
          if (filters.assignee && filters.assignee.length > 0) {
            if (!task.assignee_id || !filters.assignee.includes(task.assignee_id)) return false;
          }
          
          // 标签过滤
          if (filters.tags && filters.tags.length > 0) {
            const hasMatchingTag = filters.tags.some(tag => task.tags.includes(tag));
            if (!hasMatchingTag) return false;
          }
          
          // 关键词搜索
          if (filters.searchKeyword) {
            const keyword = filters.searchKeyword.toLowerCase();
            const matchesTitle = task.title.toLowerCase().includes(keyword);
            const matchesDescription = task.description?.toLowerCase().includes(keyword);
            if (!matchesTitle && !matchesDescription) return false;
          }
          
          // 截止日期范围过滤
          if (filters.dueDateRange) {
            if (!task.due_date) return false;
            
            const dueDate = new Date(task.due_date);
            const { start, end } = filters.dueDateRange;
            
            if (start && dueDate < new Date(start)) return false;
            if (end && dueDate > new Date(end)) return false;
          }
          
          return true;
        });
      },
      
      // ===== 重置状态 =====
      reset: () => {
        // 清理所有定时器
        const { autoSaveTimers } = get();
        autoSaveTimers.forEach(timer => clearTimeout(timer));
        
        set({
          ...initialState,
          optimisticBackups: new Map(),
          autoSaveTimers: new Map(),
        });
      },
    })),
    {
      name: 'multi-task-store',
    }
  )
);

// ===== 选择器 =====
export const useTasksSelector = () => useTaskStore(state => state.tasks);
export const useCurrentViewSelector = () => useTaskStore(state => state.currentView);
export const useCurrentLevelSelector = () => useTaskStore(state => state.currentLevel);
export const useFiltersSelector = () => useTaskStore(state => state.filters);
export const useLoadingSelector = () => useTaskStore(state => state.loading);
export const useActiveTaskSelector = () => useTaskStore(state => state.activeTask);
export const useDragErrorSelector = () => useTaskStore(state => state.dragError);
