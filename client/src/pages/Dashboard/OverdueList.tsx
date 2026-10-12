/**
 * 组件名称：超期任务列表
 * 文件作用：突出展示当前已超期的任务。
 * 主要功能：拉取超期任务、展示优先级与截止信息，并支持跳转到对应团队空间。
 */
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import TaskDetailDrawer from '@/components/task/detail/TaskDetailDrawer';
import { Badge } from '@/components/ui/badge';
import type { Task } from '@/types';
import request from '@/api/request';
import { priorityConfig } from '@/config/taskSemanticColors';
import dayjs from 'dayjs';

interface OverdueListProps {
  height: number;
  teamId?: string;
}

export default function OverdueList({ height, teamId }: OverdueListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleTaskId, setVisibleTaskId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOverdue() {
      setLoading(true);
      try {
        const params = teamId ? `?team_id=${teamId}` : '';
        const data = await request.get<Task[]>(`/dashboard/overdue${params}`);
        setTasks(data);
      } finally {
        setLoading(false);
      }
    }
    fetchOverdue();
  }, [teamId]);

  return (
    <div style={{
      background: '#FAFAFA',
      borderRadius: 8,
      padding: 'var(--tf-density-dashboard-panel-padding, 24px 32px)',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--tf-density-dashboard-panel-header-margin, 24px)' }}>
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span style={{ fontSize: 18, fontWeight: 600, color: '#37352F' }}>超期任务</span>
        {!loading && tasks.length > 0 && (
          <span style={{ color: '#9B9A97', fontSize: 13, fontWeight: 500, marginLeft: 4 }}>
            {tasks.length} 项
          </span>
        )}
      </div>

      <div style={{ height: height - 92, overflow: 'auto', margin: '0 -16px' }}>
        {loading ? (
          <div style={{ height: '100%', background: '#F3F4F6', borderRadius: 8, margin: '0 16px' }} />
        ) : tasks.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ color: '#9B9A97', fontSize: 14 }}>没有超期任务</span>
          </div>
        ) : (
          <ul className="space-y-0">
            {tasks.map((task) => (
              <li
                key={task.id}
                style={{
                  cursor: 'pointer',
                  padding: '12px 16px',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'background 0.2s',
                }}
                onClick={() => setVisibleTaskId(task.id)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#EFEFEF'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ color: '#37352F', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </span>
                    <span style={{ fontSize: 12, color: '#EF4444' }}>
                      {task.due_date ? dayjs(task.due_date).format('MM月DD日') : '未定日期'} 截止
                    </span>
                  </div>
                </div>
                <Badge
                  style={{ backgroundColor: priorityConfig[task.priority].color, color: '#fff', border: 'none' }}
                >
                  {priorityConfig[task.priority].label}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TaskDetailDrawer
        taskId={visibleTaskId}
        visible={!!visibleTaskId}
        onClose={() => setVisibleTaskId(null)}
      />
    </div>
  );
}
