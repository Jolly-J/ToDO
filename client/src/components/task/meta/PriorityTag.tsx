/**
 * 组件名称：优先级标签
 * 文件作用：把任务优先级值映射成统一的中文文案和颜色标签。
 * 主要功能：在列表、看板、详情等场景复用优先级展示样式。
 */
import { Badge } from '@/components/ui/badge';
import type { TaskPriority } from '@/types';
import { getPriorityMeta, priorityConfig, withAlpha } from '@/config/taskSemanticColors';

interface PriorityTagProps {
  priority: TaskPriority;
}

export default function PriorityTag({ priority }: PriorityTagProps) {
  const config = getPriorityMeta(priority);
  return (
    <Badge
      variant="outline"
      style={{
        borderColor: withAlpha(config.color, 0.24),
        backgroundColor: withAlpha(config.color, 0.08),
        color: config.color,
      }}
    >
      {config.label}
    </Badge>
  );
}

export { priorityConfig };
