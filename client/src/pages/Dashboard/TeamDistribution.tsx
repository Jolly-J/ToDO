/**
 * 组件名称：团队任务分布图
 * 文件作用：展示各团队在不同任务状态下的数量分布。
 * 主要功能：拉取团队分布数据，并用堆叠柱状图展示未完成、进行中、延期和完成任务。
 */
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import request from '@/api/request';
import { statusConfig } from '@/config/taskSemanticColors';

interface DistributionData {
  name: string;
  unfinished: number;
  in_progress: number;
  delayed_in_progress: number;
  done: number;
  delayed_done: number;
  canceled: number;
}

interface TeamDistributionProps {
  height: number;
}

export default function TeamDistribution({ height }: TeamDistributionProps) {
  const [data, setData] = useState<DistributionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDistribution() {
      try {
        const dist = await request.get<DistributionData[]>('/dashboard/team-distribution');
        setData(dist);
      } finally {
        setLoading(false);
      }
    }
    fetchDistribution();
  }, []);

  return (
    <div style={{ background: '#FAFAFA', borderRadius: 8, padding: 'var(--tf-density-dashboard-panel-padding, 24px 32px)', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 'var(--tf-density-dashboard-panel-header-margin, 32px)' }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#37352F' }}>团队分布</span>
        <span style={{ fontSize: 13, color: '#9B9A97', marginLeft: 12, fontWeight: 400 }}>各团队任务状态分布</span>
      </div>

      <div style={{ height: height - 100 }}>
        {loading ? (
          <div style={{ height: '100%', background: '#F3F4F6', borderRadius: 8 }} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="name"
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
              <Bar dataKey="unfinished" name="未完成" fill="#787774" radius={[3, 3, 0, 0]} />
              <Bar dataKey="in_progress" name={statusConfig.in_progress.label} fill={statusConfig.in_progress.color} radius={[3, 3, 0, 0]} />
              <Bar dataKey="delayed_in_progress" name={statusConfig.delayed_in_progress.label} fill={statusConfig.delayed_in_progress.color} radius={[3, 3, 0, 0]} />
              <Bar dataKey="done" name={statusConfig.done.label} fill={statusConfig.done.color} radius={[3, 3, 0, 0]} />
              <Bar dataKey="delayed_done" name={statusConfig.delayed_done.label} fill={statusConfig.delayed_done.color} radius={[3, 3, 0, 0]} />
              <Bar dataKey="canceled" name={statusConfig.canceled.label} fill={statusConfig.canceled.color} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
