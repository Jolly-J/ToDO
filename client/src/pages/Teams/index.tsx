/**
 * 页面名称：我的团队
 * 文件作用：展示当前用户创建和参与的团队总览。
 * 主要功能：区分我创建的团队与我参与的团队，并提供进入团队空间和创建团队入口。
 */
import { useEffect, useMemo, useState } from 'react';
import { Users, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useTeamStore } from '@/store';
import { useTourStore } from '@/components/onboarding/tourStore';
import CreateTeamModal from '@/components/team/CreateTeamModal';
import { teamLevelColors, teamLevelLabels } from '@/pages/Teams/teamMeta';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Team } from '@/types';
import { pageHeaderStyles } from '@/pages/pageHeaderStyles';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/useIsMobile';

type TeamWithCardStats = Team & {
  memberCount?: number;
  taskCount?: number;
};

type TeamCardData = Team & {
  memberCount: number;
  taskCount: number;
};

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#37352F' }}>{title}</h3>
        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#F3F4F6', color: '#6B7280' }}>
          {count}
        </span>
      </div>
    </div>
  );
}

function TeamSectionEmpty({ description }: { description: string }) {
  return (
    <div style={{ border: '1px dashed #E5E7EB', borderRadius: 16, padding: '28px 20px', background: '#FAFAF9' }}>
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-8 w-8 opacity-30" />
        <span>{description}</span>
      </div>
    </div>
  );
}

interface TeamCardProps {
  team: TeamCardData;
  ownershipLabel: string;
  ownershipTone: { background: string; color: string };
  onClick: () => void;
}

function toTeamCardData(team: TeamWithCardStats): TeamCardData {
  return {
    ...team,
    memberCount: team.memberCount ?? 0,
    taskCount: team.taskCount ?? 0,
  };
}

function TeamCard({ team, ownershipLabel, ownershipTone, onClick }: TeamCardProps) {
  const descriptionText = team.description || '该团队暂无简介';
  return (
    <div
      data-tour="teams-card-item"
      className="cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-5 transition-shadow hover:shadow-sm"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F3F4F6]">
          <Users className="h-6 w-6 text-[#6B7280]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-[#37352F]">{team.name}</span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-xs"
              style={{
                background: `${teamLevelColors[team.level] || teamLevelColors.custom}20`,
                color: teamLevelColors[team.level] || teamLevelColors.custom,
              }}
            >
              {teamLevelLabels[team.level] || team.level}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{descriptionText}</p>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span>{team.memberCount} 成员</span>
            <span>{team.taskCount} 任务</span>
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
              style={ownershipTone}
            >
              {ownershipLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Teams() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuthStore();
  const { teams, loading, fetchTeams } = useTeamStore();
  const openTour = useTourStore((state) => state.openTour);

  const [createModalVisible, setCreateModalVisible] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const { myTeams, joinedTeams } = useMemo(() => {
    const myTeams: TeamWithCardStats[] = [];
    const joinedTeams: TeamWithCardStats[] = [];
    for (const team of teams) {
      if (team.owner_id === user?.id) {
        myTeams.push(team);
      } else {
        joinedTeams.push(team);
      }
    }
    return { myTeams, joinedTeams };
  }, [teams, user?.id]);

  const openCreateModal = () => setCreateModalVisible(true);
  const closeCreateModal = () => setCreateModalVisible(false);

  const handleTeamCreated = () => {
    closeCreateModal();
    fetchTeams();
    toast.success('团队创建成功');
  };

  const teamGridClassName = `grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 xl:grid-cols-3'}`;

  return (
    <div>
      <div style={pageHeaderStyles.toolbar}>
        <div style={pageHeaderStyles.titleBlock}>
          <div className="flex items-center gap-2">
            <h2 style={pageHeaderStyles.title}>我的团队</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => openTour('teams')}
                    aria-label="查看团队列表操作指南"
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[#9B9A97] hover:text-[#37352F] hover:bg-[#EFEFEF] transition-colors cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  团队列表操作指南
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p style={pageHeaderStyles.meta}>管理你创建和参与的团队空间</p>
        </div>
        <div style={pageHeaderStyles.actions}>
          <Button data-tour="teams-create-action" onClick={openCreateModal}>
            <Users className="h-4 w-4" />
            创建团队
          </Button>
        </div>
      </div>

      {loading ? (
        <div className={teamGridClassName}>
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <div data-tour="teams-sections" className="space-y-8">
          <div>
            <SectionHeader title="我创建的团队" count={myTeams.length} />
            {myTeams.length === 0 ? (
              <TeamSectionEmpty description="你还没有创建任何团队" />
            ) : (
              <div className={teamGridClassName}>
                {myTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={toTeamCardData(team)}
                    ownershipLabel="我创建的"
                    ownershipTone={{ background: '#EFF6FF', color: '#2783DE' }}
                    onClick={() => navigate(`/teams/${team.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionHeader title="我参与的团队" count={joinedTeams.length} />
            {joinedTeams.length === 0 ? (
              <TeamSectionEmpty description="你还没有加入其他团队" />
            ) : (
              <div className={teamGridClassName}>
                {joinedTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={toTeamCardData(team)}
                    ownershipLabel="我参与的"
                    ownershipTone={{ background: '#F0FDF4', color: '#10B981' }}
                    onClick={() => navigate(`/teams/${team.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <CreateTeamModal
        visible={createModalVisible}
        onClose={closeCreateModal}
        onSuccess={handleTeamCreated}
      />
    </div>
  );
}
