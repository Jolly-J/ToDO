/**
 * 驾驶舱统计卡片数据源。
 * 文件作用：封装 /dashboard/stats 请求，供工作台 KPI 卡片与打印预览共用。
 */
import { useEffect, useState } from 'react';
import request from '@/api/request';

export interface DashboardStats {
  total: number;
  unfinished: number;
  inProgress: number;
  done: number;
  overdue: number;
}

const EMPTY_STATS: DashboardStats = { total: 0, unfinished: 0, inProgress: 0, done: 0, overdue: 0 };

export function useDashboardStats(teamId?: string, days?: number) {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (teamId) query.set('team_id', teamId);
        if (days) query.set('days', String(days));
        const qs = query.toString();
        const data = await request.get<DashboardStats>(`/dashboard/stats${qs ? `?${qs}` : ''}`);
        if (!cancelled) {
          setStats(data || EMPTY_STATS);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, [teamId, days]);

  return { stats, loading };
}
