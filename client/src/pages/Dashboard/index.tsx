/**
 * 页面名称：驾驶舱 (容器组件)
 * 文件作用：作为系统首页展示任务整体运行情况。
 * [MOBILE ADAPTATION] 统一路由模式，分发桌面/移动端视图。
 */
import { useState, useEffect } from 'react';
import { useTeamStore } from '@/store';
import { useIsMobile } from '@/hooks/useIsMobile';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

import DesktopView from './DesktopView';
import MobileView from './MobileView';
import { TIME_RANGE_MAP } from './constants';

dayjs.locale('zh-cn');

export default function Dashboard() {
  const isMobile = useIsMobile();
  const chartHeight = 360;
  const today = dayjs().format('YYYY年MM月DD日 dddd');
  const { teams, fetchTeams } = useTeamStore();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('all');

  const teamId = selectedTeamId === 'all' ? undefined : selectedTeamId;
  const days = TIME_RANGE_MAP[timeRange];

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const sharedProps = {
    today,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    timeRange,
    setTimeRange,
    teamId,
    days,
    chartHeight,
  };

  return (
    <>
      {/* [MOBILE ADAPTATION] 视图分发 */}
      {!isMobile ? (
        <DesktopView {...sharedProps} />
      ) : (
        <MobileView {...sharedProps} />
      )}
    </>
  );
}
