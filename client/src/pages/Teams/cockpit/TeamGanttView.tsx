/**
 * 组件名称：团队空间甘特图视图
 * 文件作用：将团队任务转换为甘特图时间轴并呈现。
 * 主要功能：
 *   1. 顶部提供任务状态筛选（默认进行中）；
 *   2. 支持日/周/月/年粒度切换、任务树折叠/展开、快速回到今天、仅看逾期与风险任务；
 *   3. 年视图下整年 12 个月列宽自适应容器，无需左右水平滚动；
 *   4. 支持手动缩放、完整排期全览和右下角拖动高度；点击任务打开详情。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { GanttChartSquare, Grip, Scan, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  GanttToolbar,
  GanttTimelineHeader,
  GanttTreePane,
  GanttTimelinePane,
  buildGanttRows,
  getDateOffsetPx,
  getItemGridPlacement,
  type GanttItem,
  type GanttScale,
  type GanttGridPlacement,
} from '@/components/gantt';
import type { Task } from '@/types';
import { buildTeamGanttLayout, getTimeProgress } from './teamGanttLayout';

interface TeamGanttViewProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

const ROW_HEIGHT = 40;
const LEFT_PANE_WIDTH = 280;

export default function TeamGanttView({ tasks, onTaskClick }: TeamGanttViewProps) {
  const [scale, setScale] = useState<GanttScale>('week');
  const [riskOnly, setRiskOnly] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [fit, setFit] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const resizeRef = useRef<{ pointerId: number; y: number; height: number } | null>(null);
  // 默认筛选：任务状态为“进行中”
  const [statusFilter, setStatusFilter] = useState<string>('in_progress');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const todayStr = dayjs().format('YYYY-MM-DD');

  // 1. 将任务及其潜在嵌套的 subtasks 进行扁平化
  const flattenedTasks = useMemo(() => {
    const map = new Map<string, Task>();
    const walk = (task: Task, fallbackParentId?: string) => {
      const pid = task.parent_id || fallbackParentId;
      const normalized: Task = { ...task, parent_id: pid };
      if (!map.has(normalized.id)) {
        map.set(normalized.id, normalized);
      }
      if (task.subtasks && Array.isArray(task.subtasks)) {
        task.subtasks.forEach((sub) => walk(sub, task.id));
      }
    };
    tasks.forEach((t) => walk(t));
    return Array.from(map.values());
  }, [tasks]);

  // 2. 根据状态筛选任务列表 (子任务命中时保留父任务作为树容器；父任务命中时连同子任务展示)
  const filteredTasks = useMemo(() => {
    const isSingleMatch = (task: Task): boolean => {
      const isDone = task.status === 'done' || task.status === 'delayed_done';
      const isOverdue =
        task.status === 'delayed_in_progress' ||
        Boolean(task.due_date && task.due_date.slice(0, 10) < todayStr && !isDone);

      if (statusFilter === 'in_progress') {
        if (task.status !== 'in_progress' && task.status !== 'delayed_in_progress') {
          return false;
        }
      } else if (statusFilter === 'unfinished') {
        if (isDone || task.status === 'canceled') {
          return false;
        }
      } else if (statusFilter === 'overdue') {
        if (!isOverdue) {
          return false;
        }
      } else if (statusFilter === 'done') {
        if (!isDone) {
          return false;
        }
      }

      return true;
    };

    const taskMap = new Map<string, Task>();
    flattenedTasks.forEach((t) => taskMap.set(t.id, t));

    const matchedIds = new Set<string>();
    flattenedTasks.forEach((t) => {
      if (isSingleMatch(t)) {
        matchedIds.add(t.id);
        // 子任务命中时，将其所有祖先父节点也加入，保持树完整性
        let curPid = t.parent_id;
        while (curPid && taskMap.has(curPid)) {
          matchedIds.add(curPid);
          curPid = taskMap.get(curPid)!.parent_id;
        }
      }
    });

    // 若父任务命中，也把子任务纳入
    flattenedTasks.forEach((t) => {
      if (t.parent_id && matchedIds.has(t.parent_id)) {
        matchedIds.add(t.id);
      }
    });

    return flattenedTasks.filter((t) => matchedIds.has(t.id));
  }, [flattenedTasks, statusFilter, todayStr]);

  // 3. 计算父节点集合（用于折叠/展开小箭头常驻判断）与节点深度
  const { parentIds, depthMap } = useMemo(() => {
    const pSet = new Set<string>();
    const taskMap = new Map<string, Task>();
    filteredTasks.forEach((t) => taskMap.set(t.id, t));

    filteredTasks.forEach((t) => {
      if (t.parent_id && taskMap.has(t.parent_id)) {
        pSet.add(t.parent_id);
      }
    });

    const dMap = new Map<string, number>();
    const getDepth = (id: string, visited = new Set<string>()): number => {
      if (dMap.has(id)) return dMap.get(id)!;
      if (visited.has(id)) return 0;
      visited.add(id);
      const item = taskMap.get(id);
      if (!item || !item.parent_id || !taskMap.has(item.parent_id)) {
        dMap.set(id, 0);
        return 0;
      }
      const d = getDepth(item.parent_id, visited) + 1;
      dMap.set(id, d);
      return d;
    };

    filteredTasks.forEach((t) => getDepth(t.id));
    return { parentIds: pSet, depthMap: dMap };
  }, [filteredTasks]);

  // 4. 将筛选后的任务映射为甘特图行项
  const ganttItems: GanttItem[] = useMemo(() => {
    const taskMap = new Map<string, Task>();
    filteredTasks.forEach((t) => taskMap.set(t.id, t));

    return filteredTasks.map((task, index) => {
      const isDone = task.status === 'done' || task.status === 'delayed_done';
      const isOverdue =
        task.status === 'delayed_in_progress' ||
        Boolean(task.due_date && task.due_date.slice(0, 10) < todayStr && !isDone);
      const isCritical = task.priority === 'urgent';

      const startDate = task.start_date
        ? task.start_date.slice(0, 10)
        : (task.created_at ? task.created_at.slice(0, 10) : todayStr);
      let dueDate = task.due_date ? task.due_date.slice(0, 10) : undefined;
      if (!dueDate) {
        dueDate = dayjs(startDate).add(3, 'day').format('YYYY-MM-DD');
      }

      const progress = getTimeProgress(startDate, dueDate, todayStr);

      const hasValidParent = Boolean(task.parent_id && taskMap.has(task.parent_id));

      return {
        id: task.id,
        taskId: task.id,
        type: 'task',
        parentId: hasValidParent ? (task.parent_id || undefined) : undefined,
        name: task.title,
        startDate,
        dueDate,
        progress,
        status: task.status,
        assigneeName: task.assignee_name,
        isDelayed: isOverdue,
        isCritical,
        depth: depthMap.get(task.id) ?? 0,
        sortOrder: index,
      };
    });
  }, [filteredTasks, depthMap, todayStr]);

  const allRows = useMemo(() => buildGanttRows(ganttItems), [ganttItems]);
  const visibleRows = useMemo(
    () => buildGanttRows(ganttItems, collapsedIds),
    [collapsedIds, ganttItems]
  );
  const filteredRows = useMemo(() => {
    if (!riskOnly) return visibleRows;
    return visibleRows.filter((r) => r.isDelayed || r.isCritical);
  }, [riskOnly, visibleRows]);

  // 折叠只隐藏行，不改变全览范围；风险筛选则只覆盖命中的排期。
  const rangeItems = useMemo(
    () => riskOnly ? ganttItems.filter((item) => item.isDelayed || item.isCritical) : ganttItems,
    [ganttItems, riskOnly]
  );
  const { units, renderScale, pxPerDay, timelineWidth, taskStart, taskEnd } = useMemo(
    () => buildTeamGanttLayout({
      items: rangeItems, scale, availableWidth: (containerWidth || 1000) - LEFT_PANE_WIDTH,
      today: todayStr, zoom, fit,
    }),
    [rangeItems, scale, containerWidth, todayStr, zoom, fit]
  );

  // 滚动区可能在加载或筛选后才挂载；同时监听滚动条引起的可用宽度变化。
  const hasRows = filteredRows.length > 0;
  useEffect(() => {
    const el = timelineRef.current || containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasRows]);

  const placements = useMemo(() => {
    const map = new Map<string, GanttGridPlacement>();
    allRows.forEach((row) => {
      const placement = getItemGridPlacement(row, units, pxPerDay);
      if (placement.startIndex !== -1) map.set(row.id, placement);
    });
    return map;
  }, [allRows, pxPerDay, units]);

  const handleToggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 全部折叠：仅折叠拥有子节点的父任务
  const handleCollapseAll = () => {
    setCollapsedIds(new Set(parentIds));
  };

  // 全部展开：清空折叠 ID 集合
  const handleExpandAll = () => setCollapsedIds(new Set());

  const handleScrollToToday = useCallback(() => {
    if (fit || (scale === 'year' && zoom <= 100)) {
      // 年视图整年已完整呈现在容器内，无需水平滚动
      return;
    }
    const el = timelineRef.current;
    if (!el) return;
    const offsetPx = getDateOffsetPx(todayStr, units, pxPerDay);
    if (offsetPx === null) return;
    const target = LEFT_PANE_WIDTH + offsetPx - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [fit, scale, zoom, todayStr, units, pxPerDay]);

  // 挂载或日/周/月粒度就绪后，自动平滑聚焦到今天
  useEffect(() => {
    if (fit) {
      timelineRef.current?.scrollTo({ left: 0 });
      return;
    }
    if (scale === 'year' && zoom <= 100) return;
    const timer = setTimeout(() => {
      handleScrollToToday();
    }, 150);
    return () => clearTimeout(timer);
  }, [units, scale, fit, zoom, handleScrollToToday]);

  const handleClickItem = (item: GanttItem) => {
    if (item.taskId && onTaskClick) {
      onTaskClick(item.taskId);
    }
  };

  const statusLabel =
    statusFilter === 'in_progress'
      ? '进行中'
      : statusFilter === 'unfinished'
      ? '未完成'
      : statusFilter === 'overdue'
      ? '仅逾期'
      : statusFilter === 'done'
      ? '已完成'
      : '全部状态';

  return (
    <Card ref={containerRef} className="overflow-hidden border border-[#EFEFEF] shadow-none bg-white">
      <GanttToolbar
        scale={scale}
        onScaleChange={(next) => {
          setScale(next);
          setFit(false);
          setZoom(100);
        }}
        riskOnly={riskOnly}
        onRiskOnlyChange={setRiskOnly}
        onScrollToToday={handleScrollToToday}
        onCollapseAll={handleCollapseAll}
        onExpandAll={handleExpandAll}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        taskCount={filteredRows.length}
      />

      <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          时间轴间距
          <input
            type="range" aria-label="时间轴间距" min={10} max={200} step={5}
            className="w-28 accent-primary" value={zoom} disabled={!hasRows}
            onChange={(event) => { setZoom(Number(event.target.value)); setFit(false); }}
          />
          <span className="w-10 tabular-nums">{fit ? '自适应' : `${zoom}%`}</span>
        </label>
        <Button size="xs" variant={fit ? 'secondary' : 'outline'} aria-pressed={fit}
          disabled={!hasRows} onClick={() => setFit(true)}>
          <Scan data-icon="inline-start" /> 全览
        </Button>
        <Button size="xs" variant="ghost" disabled={!hasRows}
          onClick={() => { setFit(false); setZoom(100); }}>
          <RotateCcw data-icon="inline-start" /> 恢复默认间距
        </Button>
        {fit && taskStart && taskEnd && (
          <span className="ml-auto text-xs text-muted-foreground">排期范围：{taskStart} 至 {taskEnd}</span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <GanttChartSquare className="h-10 w-10 text-[#9B9A97] mb-2" />
          <h4 className="text-base font-semibold text-[#37352F]">暂无任务数据</h4>
          <p className="text-xs text-[#787774] mt-1">创建团队任务后，甘特图将自动按时间线排布呈现</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-[#9B9A97]">
          <p>当前筛选条件（{statusLabel}）下无匹配任务。</p>
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setStatusFilter('all');
                setRiskOnly(false);
              }}
            >
              查看全部任务
            </Button>
          </div>
        </div>
      ) : (
        <div
          ref={timelineRef}
          className={cn(
            'min-w-0',
            fit ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto'
          )}
          aria-label="任务排期时间轴"
          style={{ maxHeight: height === null ? 550 : undefined, height: height ?? undefined }}
        >
          <div
            className="flex flex-col"
            style={{ width: LEFT_PANE_WIDTH + timelineWidth }}
          >
            <div className="sticky top-0 z-30 flex w-full">
              <div
                className="sticky left-0 z-40 shrink-0 border-b border-r border-[#EFEFEF] bg-[#FAFAF8] px-3 py-2 text-xs font-medium text-[#787774]"
                style={{ width: LEFT_PANE_WIDTH }}
              >
                任务名称
              </div>
              <GanttTimelineHeader units={units} pxPerDay={pxPerDay} scale={renderScale} compactLabels={fit} />
            </div>
            <div className="flex w-full">
              <div
                className="sticky left-0 z-20 shrink-0 border-r border-[#EFEFEF] bg-white"
                style={{ width: LEFT_PANE_WIDTH }}
              >
                <GanttTreePane
                  rows={filteredRows}
                  collapsedIds={collapsedIds}
                  parentIds={parentIds}
                  onToggleCollapse={handleToggleCollapse}
                  rowHeight={ROW_HEIGHT}
                  onSelectItem={handleClickItem}
                />
              </div>
              <GanttTimelinePane
                units={units}
                rows={filteredRows}
                placements={placements}
                pxPerDay={pxPerDay}
                rowHeight={ROW_HEIGHT}
                scale={renderScale}
                onClickTask={handleClickItem}
              />
            </div>
          </div>
        </div>
      )}
      {hasRows && (
        <div className="flex justify-end border-t border-border px-1">
          <button
            type="button" aria-label="调整甘特图高度"
            title="拖动调整高度；方向键调整，Home 恢复默认高度"
            className="flex size-6 touch-none cursor-ns-resize items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-primary"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              resizeRef.current = {
                pointerId: event.pointerId, y: event.clientY,
                height: timelineRef.current?.getBoundingClientRect().height || 550,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = resizeRef.current;
              if (drag?.pointerId === event.pointerId) setHeight(Math.max(200, drag.height + event.clientY - drag.y));
            }}
            onPointerUp={(event) => {
              resizeRef.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { resizeRef.current = null; }}
            onLostPointerCapture={() => { resizeRef.current = null; }}
            onKeyDown={(event) => {
              if (event.key === 'Home') { event.preventDefault(); setHeight(null); }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const current = height ?? timelineRef.current?.getBoundingClientRect().height ?? 550;
                setHeight(Math.max(200, current + (event.key === 'ArrowDown' ? 40 : -40)));
              }
            }}
          ><Grip className="size-4" /></button>
        </div>
      )}
    </Card>
  );
}
