/**
 * 页面名称：团队空间
 * 文件作用：展示单个团队的任务协作空间。
 * 主要功能：查看团队任务工作区，并进入团队设置页。
 */
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, HelpCircle } from 'lucide-react';
import { useTeamStore, useAuthStore } from '@/store';
import { useTourStore } from '@/components/onboarding/tourStore';
import TaskWorkspace from '@/pages/Tasks/TaskWorkspace';
import { pageHeaderStyles } from '@/pages/pageHeaderStyles';
import { teamLevelLabels } from '@/pages/Teams/teamMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTeam, fetchTeamDetail, fetchMembers, members } = useTeamStore();
  const user = useAuthStore((state) => state.user);
  const openTour = useTourStore((state) => state.openTour);

  useEffect(() => {
    if (id) {
      fetchTeamDetail(id);
      fetchMembers(id);
    }
  }, [id, fetchTeamDetail, fetchMembers]);

  const isTeamAdmin = Boolean(
    (currentTeam && user && currentTeam.owner_id === user.id) ||
    (members && user && members.some((m) => m.id === user.id && (m.role_id === 'owner' || m.role_id === 'admin'))) ||
    user?.globalRoleCodes?.includes('super_admin')
  );

  if (!currentTeam) return null;

  return (
    <div>
      <div style={pageHeaderStyles.toolbar}>
        <div data-tour="team-workspace-title" style={pageHeaderStyles.titleBlock}>
          <p style={pageHeaderStyles.breadcrumb}>
            <span style={pageHeaderStyles.breadcrumbLink} onClick={() => navigate('/teams')}>
              我的团队
            </span>
            <span> / 团队空间</span>
          </p>
          <div style={pageHeaderStyles.detailTitleRow}>
            <h2 style={pageHeaderStyles.title}>{currentTeam.name}</h2>
            <Badge variant="secondary">
              {teamLevelLabels[currentTeam.level] || currentTeam.level}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => openTour('team-workspace')}
                    aria-label="查看团队空间操作指南"
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[#9B9A97] hover:text-[#37352F] hover:bg-[#EFEFEF] transition-colors cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  团队空间操作指南
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p style={pageHeaderStyles.meta}>查看团队空间中的任务与协作情况</p>
        </div>
        <div style={pageHeaderStyles.actions}>
          <Button
            data-tour="team-workspace-settings"
            variant="outline"
            onClick={() => navigate(`/teams/${id}/settings`)}
          >
            <Settings className="h-4 w-4" />
            设置
          </Button>
        </div>
      </div>

      {id ? (
        <TaskWorkspace teamId={id} title="任务" containerStyle={{ minWidth: 0 }} embedded isTeamAdmin={isTeamAdmin} />
      ) : null}
    </div>
  );
}
