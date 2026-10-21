/**
 * 组件名称：团队成员任务情况面板
 * 文件作用：在团队驾驶舱中展示所有成员的任务负荷与完成情况。
 * 主要功能：请求 /api/teams/:id/cockpit/member-tasks 并在网格卡片中呈现成员任务数、逾期数、进行中及完成率。
 */
import { Users, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useMemberTaskStats } from './useMemberTaskStats';

export type { MemberTaskStat } from './useMemberTaskStats';

interface TeamMemberTaskStatusProps {
  teamId: string;
  onSelectMember?: (userId: string) => void;
}

const ROLE_LABEL: Record<string, string> = {
  owner: '创建者',
  admin: '管理员',
  member: '成员',
};

export default function TeamMemberTaskStatus({ teamId, onSelectMember }: TeamMemberTaskStatusProps) {
  const { loading, errorMsg, memberStats } = useMemberTaskStats(teamId);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-[#FEE2E2]/60 border border-[#FCA5A5] text-sm text-[#991B1B]">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <span>{errorMsg}</span>
      </div>
    );
  }

  if (memberStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-[#EFEFEF] bg-white text-center">
        <Users className="h-8 w-8 text-[#9B9A97] mb-2" />
        <p className="text-sm text-[#787774]">暂无成员任务数据</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {memberStats.map((stat) => (
        <Card
          key={stat.userId}
          onClick={() => onSelectMember && onSelectMember(stat.userId)}
          className="border-[#EFEFEF] bg-white p-4 shadow-none transition-all hover:border-[#D0D0CE] hover:shadow-xs cursor-pointer"
        >
          {/* 成员头部信息 */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10 border border-[#EFEFEF]">
              <AvatarImage src={stat.avatar} alt={stat.name} />
              <AvatarFallback className="bg-[#F0F0EF] text-xs font-semibold text-[#37352F]">
                {stat.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-[#37352F]">{stat.name}</span>
                <Badge variant={stat.role === 'owner' ? 'default' : stat.role === 'admin' ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0 h-4">
                  {ROLE_LABEL[stat.role] || stat.role}
                </Badge>
              </div>
              <div className="text-xs text-[#9B9A97] truncate mt-0.5">
                {stat.department || '未分配部门'}
              </div>
            </div>
          </div>

          {/* 指标矩阵 */}
          <div className="grid grid-cols-4 gap-2 rounded-md bg-[#FAFAF8] p-2.5 mb-3 text-center">
            <div>
              <div className="text-sm font-bold text-[#37352F]">{stat.assignedTaskCount}</div>
              <div className="text-[10px] text-[#9B9A97] mt-0.5">总任务</div>
            </div>
            <div>
              <div className="text-sm font-bold text-[#2383E2]">{stat.openTaskCount}</div>
              <div className="text-[10px] text-[#9B9A97] mt-0.5">进行中</div>
            </div>
            <div>
              <div className={`text-sm font-bold ${stat.overdueTaskCount > 0 ? 'text-[#DC2626]' : 'text-[#37352F]'}`}>
                {stat.overdueTaskCount}
              </div>
              <div className="text-[10px] text-[#9B9A97] mt-0.5 flex items-center justify-center gap-0.5">
                {stat.overdueTaskCount > 0 ? <AlertTriangle className="h-2.5 w-2.5 text-[#DC2626]" /> : null}
                逾期
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-[#0F7B0F]">{stat.completedTaskCount}</div>
              <div className="text-[10px] text-[#9B9A97] mt-0.5">已完成</div>
            </div>
          </div>

          {/* 完成率进度条 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-[#EFEFEF] overflow-hidden">
              <div
                className="h-full bg-[#10B981] transition-all"
                style={{ width: `${stat.completionRate}%` }}
              />
            </div>
            <span className="text-xs font-medium text-[#787774] shrink-0">
              {stat.completionRate}%
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
