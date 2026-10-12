/**
 * 组件名称：任务卡片
 * 文件作用：在看板等场景中展示单个任务的核心信息。
 * 主要功能：显示优先级、标题、摘要、截止日期和负责人，并支持点击查看详情。
 */
import { Calendar, GripVertical } from 'lucide-react';
import PriorityTag from '@/components/task/meta/PriorityTag';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Task } from '@/types';
import type { ButtonHTMLAttributes } from 'react';
import dayjs from 'dayjs';
import styles from './TaskCard.module.css';

type TaskCardData = Task & {
  assignee_name?: string;
  assignee_avatar?: string;
};

interface TaskCardProps {
  task: TaskCardData;
  onClick?: () => void;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
}

export default function TaskCard({ task, onClick, dragHandleProps }: TaskCardProps) {
  const isOverdue = task.due_date && dayjs(task.due_date).isBefore(dayjs(), 'day') && task.status !== 'done' && task.status !== 'delayed_done' && task.status !== 'canceled';
  const isDelayedDone = task.status === 'delayed_done';
  return (
    <div
      className={styles.card}
      style={{ padding: 'var(--tf-density-board-card-padding, 16px)', cursor: 'pointer' }}
      onClick={onClick}
    >
      <div className={styles.content}>
        <div className={styles.topRow}>
          <div className={styles.priorityRow}>
            <PriorityTag priority={task.priority} />
          </div>
          {dragHandleProps ? (
            <button
              {...dragHandleProps}
              type="button"
              className={styles.dragHandleButton}
              aria-label={`拖拽任务：${task.title}`}
              onClick={(event) => event.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className={styles.title}>{task.title}</div>
        {task.description ? <div className={styles.description}>{task.description}</div> : null}
        <div className={styles.footer}>
          {task.due_date ? (
            <span className={`${styles.metaItem} ${isOverdue || isDelayedDone ? styles.metaItemOverdue : ''}`}>
              <Calendar className="h-3.5 w-3.5" />
              {dayjs(task.due_date).year() === dayjs().year()
                ? dayjs(task.due_date).format('MM/DD')
                : dayjs(task.due_date).format('YYYY/MM/DD')
              }
              {isDelayedDone ? <span className={styles.delayedDoneLabel}>延期完成</span> : null}
            </span>
          ) : (
            <span />
          )}
          {task.assignee_id ? (
            <span className={styles.assignee}>
              <Avatar className="h-5 w-5">
                <AvatarImage src={task.assignee_avatar} />
                <AvatarFallback>{task.assignee_name?.slice(0, 1) ?? '?'}</AvatarFallback>
              </Avatar>
              {task.assignee_name ? <span className={styles.assigneeName}>{task.assignee_name}</span> : null}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
