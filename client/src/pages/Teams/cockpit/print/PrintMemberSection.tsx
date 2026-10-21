/**
 * 打印页成员负载区块。
 * 文件作用：以三列卡片矩阵呈现团队成员任务情况，卡片高度固定，便于保持网格整齐。
 */
import type { MemberTaskStat } from '../useMemberTaskStats';
import PrintSectionTitle from './PrintSectionTitle';
import {
  PRINT_MEMBER_CARD_HEIGHT_PX,
  PRINT_MEMBER_COLUMNS,
  PRINT_MEMBER_GAP_PX,
} from './printLayout';

const ROLE_LABEL: Record<string, string> = {
  owner: '创建者',
  admin: '管理员',
  member: '成员',
};

interface PrintMemberSectionProps {
  memberStats: MemberTaskStat[];
  loading: boolean;
  errorMsg: string | null;
}

function Metric({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: color ?? '#37352F', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ fontSize: 9, color: '#9B9A97' }}>{label}</span>
    </div>
  );
}

function PrintMemberCard({ stat }: { stat: MemberTaskStat }) {
  const roleLabel = ROLE_LABEL[stat.role] || stat.role;

  return (
    <div
      style={{
        height: PRINT_MEMBER_CARD_HEIGHT_PX,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        padding: '12px 14px',
        border: '1px solid #EFEFEF',
        borderRadius: 8,
        background: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: '50%',
            background: '#F0F0EF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: '#37352F',
          }}
        >
          {stat.name.slice(0, 1)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#37352F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {stat.name}
            </span>
            <span style={{ flexShrink: 0, padding: '0 5px', borderRadius: 999, background: '#F3F4F6', color: '#6B7280', fontSize: 9 }}>
              {roleLabel}
            </span>
          </div>
          <div style={{ marginTop: 2, fontSize: 10, color: '#9B9A97', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stat.department || '未分配部门'}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4,
          padding: '6px 4px',
          borderRadius: 6,
          background: '#FAFAF8',
        }}
      >
        <Metric value={stat.assignedTaskCount} label="总任务" />
        <Metric value={stat.openTaskCount} label="进行中" color="#2383E2" />
        <Metric value={stat.overdueTaskCount} label="逾期" color={stat.overdueTaskCount > 0 ? '#DC2626' : '#37352F'} />
        <Metric value={stat.completedTaskCount} label="已完成" color="#0F7B0F" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 5, borderRadius: 999, background: '#EFEFEF', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.max(0, Math.min(100, stat.completionRate))}%`,
              background: '#10B981',
              borderRadius: 999,
            }}
          />
        </div>
        <span style={{ flexShrink: 0, fontSize: 10, color: '#787774', fontVariantNumeric: 'tabular-nums' }}>
          {stat.completionRate}%
        </span>
      </div>
    </div>
  );
}

export default function PrintMemberSection({ memberStats, loading, errorMsg }: PrintMemberSectionProps) {
  return (
    <section>
      <PrintSectionTitle title="团队成员任务负载" meta={`共 ${memberStats.length} 人`} />
      {loading ? (
        <div style={{ marginTop: 10, padding: '28px 16px', borderRadius: 8, border: '1px dashed #E5E7EB', background: '#FAFAF9', textAlign: 'center', fontSize: 12, color: '#9B9A97' }}>
          成员任务数据加载中…
        </div>
      ) : errorMsg ? (
        <div style={{ marginTop: 10, padding: '28px 16px', borderRadius: 8, border: '1px dashed #FCA5A5', background: '#FEF2F2', textAlign: 'center', fontSize: 12, color: '#991B1B' }}>
          成员任务数据加载失败：{errorMsg}
        </div>
      ) : memberStats.length === 0 ? (
        <div style={{ marginTop: 10, padding: '28px 16px', borderRadius: 8, border: '1px dashed #E5E7EB', background: '#FAFAF9', textAlign: 'center', fontSize: 12, color: '#9B9A97' }}>
          暂无成员任务数据
        </div>
      ) : (
        <div
          style={{
            marginTop: 10,
            display: 'grid',
            gridTemplateColumns: `repeat(${PRINT_MEMBER_COLUMNS}, 1fr)`,
            gap: PRINT_MEMBER_GAP_PX,
          }}
        >
          {memberStats.map((stat) => (
            <PrintMemberCard key={stat.userId} stat={stat} />
          ))}
        </div>
      )}
    </section>
  );
}
