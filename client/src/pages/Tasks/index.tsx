/**
 * 页面名称：任务入口页
 * 文件作用：根据路由中的团队参数加载并打开对应任务工作区。
 * 主要功能：解析 teamId、补拉团队信息，并把任务工作区挂到独立任务页面中。
 */
import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTeamStore } from '@/store';
import TaskWorkspace from './TaskWorkspace';

export default function Tasks() {
  const { id: teamId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const resolvedTeamId = teamId || searchParams.get('teamId') || '';
  const { currentTeam, fetchTeam } = useTeamStore();

  useEffect(() => {
    if (resolvedTeamId) {
      fetchTeam(resolvedTeamId);
    }
  }, [resolvedTeamId, fetchTeam]);

  return (
    <TaskWorkspace
      teamId={resolvedTeamId}
      title={currentTeam?.name || '任务管理'}
    />
  );
}
