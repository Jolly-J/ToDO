/**
 * 组件名称：驾驶舱统计卡片
 * 文件作用：展示任务总量与关键状态指标。
 * 主要功能：按团队筛选驾驶舱统计数据，并呈现总数、未完成、进行中、已完成和超期指标。
 *          点击卡片可弹出对应状态的任务列表弹窗。
 */
import React, { useEffect, useState } from 'react';
import { LayoutGrid, Clock, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import StatCardTaskDialog from './StatCardTaskDialog';
import { useDashboardStats, type DashboardStats } from './useDashboardStats';
import { useIsMobile } from '@/hooks/useIsMobile'; // [MOBILE ONLY]
import { cn } from '@/lib/utils';

export type DashboardCardKey = 'total' | 'unfinished' | 'inProgress' | 'done' | 'overdue';

const statCards: { key: DashboardCardKey; title: string; icon: React.ReactNode; iconColor: string }[] = [
  { key: 'total',      title: '全部任务', icon: <LayoutGrid className="h-5 w-5" />,   iconColor: '#787774' },
  { key: 'unfinished', title: '未完成',   icon: <Clock className="h-5 w-5" />,         iconColor: '#787774' },
  { key: 'inProgress', title: '进行中',   icon: <RefreshCw className="h-5 w-5" />,     iconColor: '#F59E0B' },
  { key: 'done',       title: '已完成',   icon: <CheckCircle className="h-5 w-5" />,   iconColor: '#10B981' },
  { key: 'overdue',    title: '已超期',   icon: <AlertTriangle className="h-5 w-5" />, iconColor: '#EF4444' },
];

const SKELETON_STYLES: React.CSSProperties = {
  display: 'inline-block',
  width: 48,
  height: 48,
  borderRadius: 4,
  background: '#E9E9E7',
  verticalAlign: 'middle',
};

interface StatCardsProps {
  teamId?: string;
  days?: number;
}

export default function StatCards({ teamId, days }: StatCardsProps) {
  const isMobile = useIsMobile(); // [MOBILE ONLY]
  const { stats, loading } = useDashboardStats(teamId, days);
  const [fadeIn, setFadeIn] = useState(true);
  const [activeCard, setActiveCard] = useState<{ key: DashboardCardKey; title: string } | null>(null);

  useEffect(() => {
    // 数据变化时先隐藏再延迟淡入，避免数字瞬切；用定时器异步更新，避免 effect 内同步 setState。
    const timer = setTimeout(() => setFadeIn(!loading), loading ? 0 : 30);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <>
      <div 
        className={cn(
          "grid gap-[var(--tf-density-dashboard-grid-gap)]",
          isMobile ? "grid-cols-2" : "grid-cols-5" // [MOBILE ONLY] 移动端 2 列，桌面端 5 列
        )}
      >
        {statCards.map((card) => (
          <div
            key={card.key}
            onClick={() => setActiveCard({ key: card.key, title: card.title })}
            className={cn(
              "flex flex-col gap-3 rounded-lg bg-[#FAFAFA] transition-all cursor-pointer hover:bg-[#F0F0EF]", // [MOBILE ADAPTATION] 移除 border，圆角 8px
              isMobile ? "p-4" : "p-[var(--tf-density-dashboard-card-padding)]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#787774] font-medium">{card.title}</span>
              <span style={{ color: card.iconColor }}>{card.icon}</span>
            </div>
            {loading ? (
              <span style={SKELETON_STYLES} />
            ) : (
              <span className={cn(
                "font-bold text-[#37352F] leading-none transition-all duration-300",
                isMobile ? "text-2xl" : "text-[length:var(--tf-density-dashboard-stat-size)]", // [MOBILE ONLY] 移动端文字缩小
                fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"
              )}>
                {stats[card.key as keyof DashboardStats]}
              </span>
            )}
          </div>
        ))}
      </div>


      <StatCardTaskDialog
        open={!!activeCard}
        onOpenChange={(open) => { if (!open) setActiveCard(null); }}
        cardKey={activeCard?.key ?? 'total'}
        cardTitle={activeCard?.title ?? ''}
        teamId={teamId}
        days={days}
      />
    </>
  );
}
