/**
 * 组件名称：任务工作台主切换卡片组
 * 文件作用：为任务类页面提供统一的卡片式主维度切换入口。
 * 主要功能：展示可选卡片、支持激活态切换，并复用在个人任务和团队任务工作区中。
 * 使用 shadcn Card 组件适配主题 CSS 变量。
 */
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export interface TaskWorkbenchCardItem {
  key: string;
  label: string;
  description?: string;
  value?: React.ReactNode;
}

interface TaskWorkbenchCardsProps {
  items: TaskWorkbenchCardItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function TaskWorkbenchCards({
  items,
  activeKey,
  onChange,
  className,
}: TaskWorkbenchCardsProps) {
  return (
    <div
      data-testid="task-workbench-cards"
      className={cn('grid gap-[var(--tf-density-workbench-card-gap)]', className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const isActive = activeKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[var(--tf-density-workbench-card-radius)]"
          >
            <Card
              className={cn(
                'flex h-full cursor-pointer flex-col gap-2.5 p-[var(--tf-density-workbench-card-padding)] transition-colors duration-150',
                'hover:bg-accent hover:border-border',
                isActive
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-semibold text-foreground leading-none">
                  {item.label}
                </span>
                {item.value != null && (
                  <span className="text-xl font-semibold text-foreground leading-none">
                    {item.value}
                  </span>
                )}
              </div>
              {item.description && (
                <span className="text-[13px] text-muted-foreground leading-relaxed">
                  {item.description}
                </span>
              )}
            </Card>
          </button>
        );
      })}
    </div>
  );
}
