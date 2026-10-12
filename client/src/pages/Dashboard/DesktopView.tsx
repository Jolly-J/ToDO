/**
 * [MOBILE ADAPTATION] 驾驶舱桌面视图
 * 提取自原 Dashboard/index.tsx。
 */
import { StatCards, TrendChart, TeamDistribution, OverdueList } from './components';
import { TIME_OPTIONS } from './constants';
import { ButtonGroup } from '@/components/ui/button-group';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Team } from '@/types';

interface DesktopViewProps {
  today: string;
  teams: Team[];
  selectedTeamId: string;
  setSelectedTeamId: (id: string) => void;
  timeRange: string;
  setTimeRange: (range: string) => void;
  teamId?: string;
  days?: number;
  chartHeight: number;
}

export default function DesktopView({
  today,
  teams,
  selectedTeamId,
  setSelectedTeamId,
  timeRange,
  setTimeRange,
  teamId,
  days,
  chartHeight,
}: DesktopViewProps) {
  return (
    <div style={{ paddingBottom: 'var(--tf-density-dashboard-section-gap, 64px)', width: '100%', maxWidth: '100%', minWidth: 0 }}>
      {/* 页面标题区 */}
      <div style={{ marginBottom: 'var(--tf-density-dashboard-title-margin-bottom, 40px)', marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--tf-density-toolbar-gap, 12px)', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--tf-density-dashboard-title-size, 36px)', fontWeight: 700, color: '#37352F', lineHeight: 1.2, margin: 0 }}>
            工作台
          </h1>
          <div style={{ fontSize: 14, color: '#9B9A97', marginTop: 8 }}>
            {today}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ButtonGroup>
            {TIME_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={timeRange === opt.value ? 'default' : 'outline'}
                size="sm"
                className="h-[var(--tf-density-button-height)] px-[var(--tf-density-button-padding-x)] text-xs"
                onClick={() => setTimeRange(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </ButtonGroup>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger className="h-[var(--tf-density-button-height)] w-28 shadow-none text-xs">
              <SelectValue placeholder="筛选团队" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部团队</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div style={{ marginBottom: 'var(--tf-density-dashboard-section-gap, 32px)' }}>
        <StatCards teamId={teamId} days={days} />
      </div>

      <div style={{ marginBottom: 'var(--tf-density-dashboard-grid-gap, 24px)' }}>
        <TrendChart height={chartHeight} teamId={teamId} />
      </div>

      {/* 团队分布 + 超期任务 */}
      <div className="grid grid-cols-2 gap-[var(--tf-density-dashboard-grid-gap)]">
        <TeamDistribution height={chartHeight} />
        <OverdueList height={chartHeight} teamId={teamId} />
      </div>
    </div>
  );
}
