/**
 * 打印页 KPI 区块。
 * 文件作用：以静态卡片形式呈现团队指标总览，样式与工作台统计卡片保持一致。
 */
import type { DashboardStats } from '@/pages/Dashboard/useDashboardStats';

interface PrintKpiSectionProps {
  stats: DashboardStats;
  loading: boolean;
}

const KPI_CARDS: Array<{ key: keyof DashboardStats; title: string; color?: string }> = [
  { key: 'total', title: '全部任务' },
  { key: 'unfinished', title: '未完成' },
  { key: 'inProgress', title: '进行中', color: '#F59E0B' },
  { key: 'done', title: '已完成', color: '#10B981' },
  { key: 'overdue', title: '已超期', color: '#EF4444' },
];

export default function PrintKpiSection({ stats, loading }: PrintKpiSectionProps) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#37352F' }}>团队指标总览</h3>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
          marginTop: 10,
        }}
      >
        {KPI_CARDS.map((card) => (
          <div
            key={card.key}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '14px 16px',
              borderRadius: 8,
              background: '#FAFAFA',
              border: '1px solid #F3F3F1',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 500, color: '#787774' }}>{card.title}</span>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                lineHeight: 1,
                color: card.color ?? '#37352F',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {loading ? '—' : stats[card.key]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
