import dayjs from 'dayjs';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';
import StatusTag from '@/components/task/meta/StatusTag';
import PriorityTag from '@/components/task/meta/PriorityTag';

interface MobileTaskCardProps {
  task: Task;
  onClick: () => void;
  className?: string;
}

/**
 * [MOBILE ADAPTATION] 移动端专用的任务列表卡片组件 (MOBILE ONLY)
 * 严格遵循 @style.md 的 Notion 风格：无边框、无阴影、背景色区分。
 */
export default function MobileTaskCard({ task, onClick, className }: MobileTaskCardProps) {
  const isOverdue = task.due_date && 
    dayjs(task.due_date).isBefore(dayjs(), 'day') && 
    task.status !== 'done' && 
    task.status !== 'delayed_done' &&
    task.status !== 'canceled';

  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3 p-4 bg-[#FAFAFA] border border-[#E9E9E7] rounded-lg active:bg-[#EFEFEF] transition-colors cursor-pointer", // [MOBILE ADAPTATION] 增加轻微边框
        className
      )}
    >
      <div className="flex justify-between items-start gap-3">
        <h3 className={cn(
          "text-[15px] font-semibold leading-snug line-clamp-2",
          isOverdue ? "text-[#EF4444]" : "text-[#37352F]"
        )}>
          {task.title}
        </h3>
        <div className="shrink-0 pt-0.5"> {/* [MOBILE ADAPTATION] 防止标签被长标题挤压变形 */}
          <PriorityTag priority={task.priority} />
        </div>
      </div>

      {task.description && (
        <p className="text-[13px] text-[#787774] line-clamp-1 leading-normal">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#E9E9E7]">
        <div className="flex items-center gap-2">
          <StatusTag status={task.status} />
          {task.team_name ? (
            <span className="text-[11px] text-[#9B9A97]">
              {task.team_name}
            </span>
          ) : (
            <span className="text-[11px] text-[#9B9A97]">
              个人任务
            </span>
          )}
          {task.assignee_name && (
             <span className="text-[11px] text-[#9B9A97]">
              · {task.assignee_name}
           </span>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-[11px] font-medium",
            isOverdue ? "text-[#EF4444] font-bold" : "text-[#9B9A97]"
          )}>
            {task.due_date ? dayjs(task.due_date).format('MM/DD') : '无截止'}
          </span>
        </div>
      </div>
    </div>
  );
}
