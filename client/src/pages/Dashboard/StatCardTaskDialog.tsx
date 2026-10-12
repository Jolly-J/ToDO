/**
 * 组件名称：统计卡片任务列表弹窗
 * 文件作用：点击驾驶舱统计卡片后，以 Dialog 形式展示对应状态的任务清单。
 * [MOBILE ADAPTATION] 使用 ResponsiveDialog，在移动端自动切换为底部抽屉模式。
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import type { Task } from '@/types';
import request from '@/api/request';
import { priorityConfig, statusConfig } from '@/config/taskSemanticColors';
import TaskDetailDrawer from '@/components/task/detail/TaskDetailDrawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'; // [MOBILE ONLY]
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/useIsMobile'; // [MOBILE ONLY]
import { cn } from '@/lib/utils';
import type { DashboardCardKey } from './StatCards';

interface StatCardTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardKey: DashboardCardKey;
  cardTitle: string;
  teamId?: string;
  days?: number;
}

/** cardKey → 后端 status 参数映射 */
const STATUS_MAP: Record<DashboardCardKey, string> = {
  total: 'all',
  unfinished: 'unfinished',
  inProgress: 'in_progress',
  done: 'done',
  overdue: 'overdue',
};

interface TaskPage {
  list: Task[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 15;

export default function StatCardTaskDialog({
  open,
  onOpenChange,
  cardKey,
  cardTitle,
  teamId,
  days,
}: StatCardTaskDialogProps) {
  const isMobile = useIsMobile(); // [MOBILE ONLY]
  const [data, setData] = useState<TaskPage>({ list: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  const fetchTasks = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: STATUS_MAP[cardKey],
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (teamId) params.set('team_id', teamId);
      if (days) params.set('days', String(days));
      const res = await request.get<TaskPage>(`/dashboard/tasks?${params.toString()}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [cardKey, teamId, days]);

  useEffect(() => {
    if (open) fetchTasks(1);
  }, [open, fetchTasks]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    fetchTasks(page);
  };

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={cardTitle}
        description={`共 ${data.total} 项任务`}
      >
        <div className={cn("flex flex-col", isMobile ? "h-full" : "h-[480px]")}>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <span className="text-sm text-muted-foreground">加载中…</span>
              </div>
            ) : data.list.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <span className="text-sm text-muted-foreground">暂无任务</span>
              </div>
            ) : (
              <ul className="px-2">
                {data.list.map((task, idx) => (
                  <li key={task.id}>
                    <div
                      onClick={() => {
                        onOpenChange(false);
                        setActiveTaskId(task.id);
                      }}
                      className="flex items-center gap-3 rounded-lg px-4 py-3.5 cursor-pointer transition-colors hover:bg-[#EFEFEF] active:bg-[#F3F4F6] overflow-hidden" // [MOBILE ADAPTATION] 统一圆角和背景色
                    >
                      <div className="flex-1 min-w-0 w-0">
                        <div className="text-[14px] font-semibold truncate text-[#37352F]">
                          {task.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                          {task.status && (
                            <span
                              className="text-[11px] shrink-0 font-medium"
                              style={{ color: statusConfig[task.status]?.color ?? '#9B9A97' }}
                            >
                              {statusConfig[task.status]?.label ?? task.status}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-[11px] shrink-0 text-[#9B9A97]">
                              {dayjs(task.due_date).format('MM/DD')} 截止
                            </span>
                          )}
                          {task.team_name && (
                            <span className="text-[11px] truncate text-[#9B9A97]">
                              {task.team_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        className="rounded-lg shadow-none border-none text-[10px] px-2 py-0.5 h-5"
                        style={{
                          backgroundColor: priorityConfig[task.priority]?.color ?? '#6B7280',
                          color: '#fff',
                        }}
                      >
                        {priorityConfig[task.priority]?.label ?? '未设置'}
                      </Badge>
                    </div>
                    {idx < data.list.length - 1 && (
                      <Separator className="mx-4 bg-[#F0F0EF]" />
                    )}
                  </li>
                ))}
                {/* 底部留白 */}
                <li className="h-6" aria-hidden />
              </ul>
            )}
          </div>

          {/* 分页控制区 */}
          {data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#F0F0EF] bg-white">
              <span className="text-xs text-muted-foreground">
                第 {data.page}/{totalPages} 页
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={data.page <= 1}
                  onClick={() => handlePageChange(data.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={data.page >= totalPages}
                  onClick={() => handlePageChange(data.page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </ResponsiveDialog>

      <TaskDetailDrawer
        taskId={activeTaskId}
        visible={!!activeTaskId}
        onClose={() => setActiveTaskId(null)}
      />
    </>
  );
}
