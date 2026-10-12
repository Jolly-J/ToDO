/**
 * 组件名称：任务工作台区域容器
 * 文件作用：为任务类页面提供统一的内容包裹层和稳定的测试锚点。
 * 主要功能：承载工作台主体内容，并支持页面按需叠加不同的布局样式。
 */
import styles from './TaskWorkbenchSurface.module.css';

interface TaskWorkbenchSurfaceProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

export default function TaskWorkbenchSurface({
  children,
  className,
  testId = 'task-workbench-surface',
}: TaskWorkbenchSurfaceProps) {
  return (
    <section
      data-testid={testId}
      className={`${styles.surface} ${className || ''}`.trim()}
    >
      {children}
    </section>
  );
}
