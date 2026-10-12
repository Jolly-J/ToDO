/**
 * 组件名称：任务标题预览
 * 文件作用：为任务列表类场景提供统一的标题截断与完整标题悬浮预览。
 * 主要功能：单行省略显示任务标题，并通过 title 保留完整文本。
 */
import styles from './TaskTitlePreview.module.css';

interface TaskTitlePreviewProps {
  title: string;
  className?: string;
}

export default function TaskTitlePreview({ title, className }: TaskTitlePreviewProps) {
  return (
    <span className={`${styles.text} ${className || ''}`.trim()} title={title}>
      {title}
    </span>
  );
}
