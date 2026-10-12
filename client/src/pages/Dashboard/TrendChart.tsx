/**
 * 组件名称：任务趋势图
 * 文件作用：展示任务新增与完成数量的时间趋势。
 * 主要功能：支持周、月、年维度切换，并用折线图对比新增与完成变化。
 */
import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import request from '@/api/request';
import dayjs from 'dayjs';

interface TrendData {
  date: string;
  created: number;
  completed: number;
}

interface ChartPoint {
  label: string;
  date: string;
  created: number;
  completed: number;
}

interface TrendChartProps {
  height: number;
  teamId?: string;
}

const CARD_STYLE: React.CSSProperties = {
  background: '#FAFAFA',
  borderRadius: 8,
  padding: 'var(--tf-density-dashboard-panel-padding, 24px 32px)',
};

export default function TrendChart({ height, teamId }: TrendChartProps) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    async function fetchTrend() {
      setLoading(true);
      try {
        const params = teamId ? `?team_id=${teamId}` : '';
        const trend = await request.get<TrendData[]>(`/dashboard/trend${params}`);
        const filteredTrend = timeRange === 'week' ? trend.slice(-7) : trend.slice(-30);

        const sourceData: TrendData[] =
          timeRange === 'year'
            ? Object.values(
                filteredTrend.reduce<Record<string, TrendData>>((acc, item) => {
                  const monthKey = dayjs(item.date).format('YYYY-MM');
                  if (!acc[monthKey]) {
                    acc[monthKey] = { date: monthKey, created: 0, completed: 0 };
                  }
                  acc[monthKey].created += item.created;
                  acc[monthKey].completed += item.completed;
                  return acc;
                }, {})
              )
            : filteredTrend;

        setData(
          sourceData.map((d) => ({
            date: d.date,
            label:
              timeRange === 'year'
                ? dayjs(`${d.date}-01`).format('M月')
                : dayjs(d.date).format('M/D'),
            created: d.created,
            completed: d.completed,
          }))
        );
      } finally {
        setLoading(false);
      }
    }
    fetchTrend();
  }, [timeRange, teamId]);

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--tf-density-toolbar-gap, 12px)', flexWrap: 'wrap', marginBottom: 'var(--tf-density-dashboard-panel-header-margin, 32px)' }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#37352F' }}>任务趋势</span>
          <span style={{ fontSize: 13, color: '#9B9A97', marginLeft: 12, fontWeight: 400 }}>增量统计比对</span>
        </div>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as 'week' | 'month' | 'year')}>
          <TabsList className="h-7">
            <TabsTrigger value="week" className="px-2.5 text-xs">周</TabsTrigger>
            <TabsTrigger value="month" className="px-2.5 text-xs">月</TabsTrigger>
            <TabsTrigger value="year" className="px-2.5 text-xs">年</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div style={{ height: height - 100 }}>
        {loading ? (
          <div style={{ height: '100%', background: '#F3F4F6', borderRadius: 8 }} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#9B9A97' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#9B9A97' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E9E9E7', fontSize: 13 }}
                labelStyle={{ color: '#37352F', fontWeight: 500 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 13, color: '#787774' }}
                iconType="circle"
                iconSize={8}
              />
              <Line
                type="monotone"
                dataKey="created"
                name="新增"
                stroke="#2783DE"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="completed"
                name="完成"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
