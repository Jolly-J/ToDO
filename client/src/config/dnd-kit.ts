/**
 * @dnd-kit 拖拽系统基础配置
 * 定义传感器（Pointer/Keyboard）、碰撞检测策略及排序动画参数
 */

import {
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { DragRestrictions, ExtendedTask, TaskStatus } from '@/types/multi-board';

// ===== 拖拽传感器配置 =====
export const useDragSensors = () => {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 移动距离后开始拖拽
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
};

// ===== 碰撞检测算法 =====
export const collisionDetection: CollisionDetection = closestCorners;

// ===== 拖拽限制验证 =====
export const validateDragOperation = (
  task: ExtendedTask,
  targetStatus: TaskStatus,
  restrictions: DragRestrictions,
  userPermissions: string[]
): { allowed: boolean; reason?: string } => {
  // 检查跨层级权限
  if (!restrictions.allowCrossLevel && task.level !== task.level) {
    return { allowed: false, reason: '没有跨层级移动权限' };
  }
  
  // 检查跨团队权限
  if (!restrictions.allowCrossTeam) {
    return { allowed: false, reason: '没有跨团队移动权限' };
  }
  
  // 检查目标状态是否允许
  if (!restrictions.allowedStatuses.includes(targetStatus)) {
    return { allowed: false, reason: '目标状态不允许' };
  }
  
  // 检查用户权限
  if (!userPermissions.includes('task:move')) {
    return { allowed: false, reason: '没有移动任务权限' };
  }
  
  return { allowed: true };
};

// ===== 拖拽排序策略 =====
export const getDragStrategy = (direction: 'vertical' | 'horizontal') => {
  return direction === 'vertical' 
    ? verticalListSortingStrategy 
    : horizontalListSortingStrategy;
};

// ===== 拖拽事件处理器类型 =====
export interface DragHandlers {
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

// ===== 默认拖拽配置 =====
export const defaultDragRestrictions: DragRestrictions = {
  allowCrossLevel: false,
  allowCrossTeam: false,
  allowedStatuses: ['in_progress', 'delayed_in_progress', 'done', 'delayed_done', 'canceled'],
};

// ===== 拖拽上下文提供者配置 =====
export const dragContextConfig = {
  sensors: useDragSensors(),
  collisionDetection,
  autoScroll: true,
  measuring: {
    droppable: {
      strategy: 'always' as const,
    },
  },
};

// ===== 拖拽覆盖层样式 =====
export const dragOverlayStyles = {
  cursor: 'grabbing',
  transform: 'rotate(5deg)',
  opacity: 0.8,
  zIndex: 1000,
};

// ===== 可放置区域高亮样式 =====
export const dropZoneStyles = {
  active: {
    backgroundColor: 'rgba(24, 144, 255, 0.1)',
    border: '2px dashed #1890ff',
    borderRadius: '8px',
  },
  over: {
    backgroundColor: 'rgba(24, 144, 255, 0.2)',
    border: '2px solid #1890ff',
    borderRadius: '8px',
  },
};

// ===== 拖拽动画配置 =====
export const dragAnimationConfig = {
  duration: 200,
  easing: 'ease-out',
};
