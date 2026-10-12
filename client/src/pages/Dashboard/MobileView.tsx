/**
 * [MOBILE ADAPTATION] 驾驶舱移动端视图 (MOBILE ONLY)
 * 简化布局，增强移动端单手操作与信息密度平衡。
 */
import { StatCards, TrendChart, TeamDistribution, OverdueList } from './components';
import { TIME_OPTIONS } from './constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Team } from '@/types';

interface MobileViewProps {
  today: string;
  teams: Team[];
  selectedTeamId: string;
  setSelectedTeamId: (id: string) => void;
  timeRange: string;
  setTimeRange: (range: string) => void;
  teamId?: string;
  days?: number;
}

export default function MobileView({
  today,
  teams,
  selectedTeamId,
  setSelectedTeamId,
  timeRange,
  setTimeRange,
  teamId,
  days,
}: MobileViewProps) {
  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* 1. 移动端页头 */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[#37352F]">工作台</h1>
        <div className="text-[12px] text-muted-foreground">{today}</div>
      </div>

      {/* 2. 筛选控制区 - 移动端优化 */}
      <div className="flex flex-col gap-3 p-4 bg-[#F9FAFB] rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-[#787774]">时间范围</span>
          <ToggleGroup 
            type="single" 
            value={timeRange} 
            onValueChange={(val) => val && setTimeRange(val)}
            variant="outline"
            size="sm"
            className="bg-[#EFEFEF] rounded-md p-0.5"
          >
            {TIME_OPTIONS.map((opt) => (
              <ToggleGroupItem 
                key={opt.value} 
                value={opt.value}
                className="px-3 h-7 text-[11px] data-[state=on]:bg-white data-[state=on]:text-[#37352F] border-none rounded-md shadow-none"
              >
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-[#787774]">筛选团队</span>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger className="w-[140px] h-8 bg-white border-none text-[12px] rounded-md shadow-none">
              <SelectValue placeholder="全部团队" />
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

      {/* 3. KPI 卡片 */}
      <section>
        <StatCards teamId={teamId} days={days} />
      </section>

      {/* 4. 图表区 - 移动端高度适当压缩 */}
      <div className="flex flex-col gap-6">
        <div className="bg-[#FAFAFA] p-5 rounded-lg overflow-hidden">
          <h3 className="text-sm font-bold mb-4 text-[#37352F]">任务趋势</h3>
          <TrendChart height={240} teamId={teamId} />
        </div>

        <div className="bg-[#FAFAFA] p-5 rounded-lg">
          <h3 className="text-sm font-bold mb-4 text-[#37352F]">团队任务分布</h3>
          <TeamDistribution height={260} />
        </div>

        <div className="bg-[#FAFAFA] p-5 rounded-lg">
          <h3 className="text-sm font-bold mb-4 text-[#37352F]">超期任务</h3>
          <OverdueList height={300} teamId={teamId} />
        </div>
      </div>
    </div>
  );
}
