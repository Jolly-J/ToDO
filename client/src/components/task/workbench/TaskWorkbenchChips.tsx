/**
 * 组件名称：任务工作台轻量切换条
 * 文件作用：为任务类页面提供统一的轻量 chip 式切换入口。
 * 主要功能：展示一组扁平按钮，支持激活态切换与可选图标，并复用在状态筛选和视图切换场景中。
 */
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export interface TaskWorkbenchChipItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

interface TaskWorkbenchChipsProps {
  items: TaskWorkbenchChipItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function TaskWorkbenchChips({
  items,
  activeKey,
  onChange,
  className,
}: TaskWorkbenchChipsProps) {
  return (
    <ToggleGroup
      type="single"
      value={activeKey}
      onValueChange={(val) => { if (val) onChange(val); }}
      variant="outline"
      size="sm"
      spacing={0}
      data-testid="task-workbench-chips"
      className={className}
    >
      {items.map((item) => (
        <ToggleGroupItem key={item.key} value={item.key} className="gap-1.5 text-xs">
          {item.icon}
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
