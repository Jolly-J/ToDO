/**
 * 组件名称：状态标签
 * 文件作用：把任务状态值映射成统一的中文文案和颜色标签。
 * 主要功能：在任务列表、看板列头和详情信息中复用状态展示。
 */
import { Badge } from '@/components/ui/badge';
import type { TaskStatus } from '@/types';
import { getStatusMeta, statusConfig, withAlpha } from '@/config/taskSemanticColors';

interface StatusTagProps {
  status: TaskStatus;
}

export default function StatusTag({ status }: StatusTagProps) {
  const config = getStatusMeta(status);
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

export { statusConfig };
