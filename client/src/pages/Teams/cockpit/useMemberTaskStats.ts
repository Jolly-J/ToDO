/**
 * 团队成员任务负载数据源。
 * 文件作用：封装 /teams/:id/cockpit/member-tasks 请求，供成员负载面板与打印预览共用。
 */
import { useEffect, useState } from 'react';
import request from '@/api/request';

export interface MemberTaskStat {
  userId: string;
  name: string;
  avatar?: string;
  department?: string;
  role: 'owner' | 'admin' | 'member';
  assignedTaskCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
  urgentTaskCount: number;
  completedTaskCount: number;
  completionRate: number;
}

export function useMemberTaskStats(teamId: string) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [memberStats, setMemberStats] = useState<MemberTaskStat[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const data = await request.get<MemberTaskStat[]>(`/teams/${teamId}/cockpit/member-tasks`);
        if (!cancelled) {
          setMemberStats(data || []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error && err.message ? err.message : '获取团队成员任务统计失败');
          setLoading(false);
        }
      }
    }

    if (teamId) {
      fetchStats();
    }
    return () => { cancelled = true; };
  }, [teamId]);

  return { loading, errorMsg, memberStats };
}
