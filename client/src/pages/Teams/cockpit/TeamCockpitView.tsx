/**
 * 组件名称：团队空间驾驶舱视图
 * 文件作用：团队管理员专用的统一管控看板。
 * 主要功能：
 *   1. 顶部展示团队工作台 KPI 卡片 (复用 StatCards)；
 *   2. 中部展示团队任务甘特图 (TeamGanttView)，并把显示属性上报给团队空间页头；
 *   3. 下部展示团队成员任务情况面板 (TeamMemberTaskStatus)。
 */
import React from 'react';
import StatCards from '@/pages/Dashboard/StatCards';
import TeamGanttView from './TeamGanttView';
import TeamMemberTaskStatus from './TeamMemberTaskStatus';
import type { TeamGanttViewState } from './teamGanttModel';
import type { Task } from '@/types';

interface TeamCockpitViewProps {
  teamId: string;
  tasks: Task[];
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  onTaskClick?: (taskId: string) => void;
  onSelectMember?: (userId: string) => void;
  /** 甘特图筛选、风险过滤与折叠状态变化时上报，供打印预览沿用。 */
  onGanttViewStateChange?: (state: TeamGanttViewState) => void;
}

export default function TeamCockpitView({
  teamId,
  tasks,
  toolbarStart,
  toolbarEnd,
  onTaskClick,
  onSelectMember,
  onGanttViewStateChange,
}: TeamCockpitViewProps) {
  return (
    <div className="w-full min-w-0">
      {/* 统一操作工具栏 */}
      {(toolbarStart || toolbarEnd) ? (
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">{toolbarStart}</div>
          <div className="flex items-center gap-2">{toolbarEnd}</div>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 w-full pt-1 pb-6">
        {/* 1. 顶部工作台 KPI 卡片 */}
        <section>
          <div className="text-sm font-semibold text-[#37352F] mb-3">团队指标总览</div>
          <StatCards teamId={teamId} />
        </section>

        {/* 2. 中部任务甘特图 */}
        <section>
          <div className="text-sm font-semibold text-[#37352F] mb-3">任务排期甘特图</div>
          <TeamGanttView
            tasks={tasks}
            onTaskClick={onTaskClick}
            onViewStateChange={onGanttViewStateChange}
          />
        </section>

        {/* 3. 下部团队成员任务情况 */}
        <section>
          <div className="text-sm font-semibold text-[#37352F] mb-3">团队成员任务负载</div>
          <TeamMemberTaskStatus teamId={teamId} onSelectMember={onSelectMember} />
        </section>
      </div>
    </div>
  );
}
