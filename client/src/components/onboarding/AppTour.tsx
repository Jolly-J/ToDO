/**
 * 组件名称：系统新手引导 (AppTour)
 * 文件作用：基于 antd 的 Tour 组件为新用户提供核心导航与功能的导览。
 */
import { Tour, ConfigProvider, type TourProps } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import { useTourStore } from './tourStore';
import { useAuthStore } from '@/store';

export default function AppTour() {
  const { open, tourType, currentStep, setCurrentStep, markCompleted, closeTour } = useTourStore();
  const { user } = useAuthStore();

  const handleClose = () => {
    markCompleted(user?.id);
    closeTour();
  };

  const globalSteps: TourProps['steps'] = [
    {
      title: '驾驶舱（工作台）',
      description: '系统的“仪表盘”总览。在此可以实时掌握今日概览、KPI 数据统计、任务完成趋势图以及超期任务预警，掌控全局进度。',
      target: () => document.querySelector('[data-tour="nav-dashboard"]') as HTMLElement,
      placement: 'rightTop',
    },
    {
      title: '我的任务',
      description: '属于您的个人待办中心。集中处理指派给您的任务、待办事项与未完成红点提醒，支持快速筛选与状态流转。',
      target: () => document.querySelector('[data-tour="nav-my-tasks"]') as HTMLElement,
      placement: 'rightTop',
    },
    {
      title: '我的团队',
      description: '团队协同中枢。集中查看您加入的所有团队空间、管理团队成员架构、进入专属团队任务看板与甘特图。',
      target: () => document.querySelector('[data-tour="nav-teams"]') as HTMLElement,
      placement: 'rightTop',
    },
    {
      title: '团队快捷入口',
      description: '所有您加入或创建的团队都会在此列表自动展示，点击即可一键直达对应团队看板与专属任务安排。',
      target: () => document.querySelector('[data-tour="team-shortcuts"]') as HTMLElement,
      placement: 'rightTop',
    },
    {
      title: '快速创建任务',
      description: '核心操作入口。无论您处于哪个页面，点击此处即可随时发起新任务，快速指派负责人与设置截止日期。',
      target: () => document.querySelector('[data-tour="action-create-task"]') as HTMLElement,
      placement: 'right',
    },
    {
      title: '创建协同 Team',
      description: '快速搭建专属团队空间，支持添加团队成员、分配管理员角色与配置团队专属任务流，开启多人协同。',
      target: () => document.querySelector('[data-tour="action-create-team"]') as HTMLElement,
      placement: 'right',
    },
    {
      title: '个人中心与随时重温',
      description: '支持自定义个性化头像与系统设置。如果您后续想重温系统功能介绍，也可以随时在头像菜单中点击【新手引导】再次唤起！',
      target: () => document.querySelector('[data-tour="user-profile"]') as HTMLElement,
      placement: 'rightBottom',
    },
  ];

  const myTasksSteps: TourProps['steps'] = [
    {
      title: '多维度任务视角',
      description: '快速在【分派给我的】、【我参与的】、【我创建的】和【分享给我的】之间切换，按协作关系聚焦工作。',
      target: () => document.querySelector('[data-tour="my-tasks-scope"]') as HTMLElement,
      placement: 'bottom',
    },
    {
      title: '状态快捷筛选',
      description: '点击切换【进行中】、【已完成】、【已逾期】等任务状态，快速收敛出当前最需要处理的事项。',
      target: () => document.querySelector('[data-tour="my-tasks-status"]') as HTMLElement,
      placement: 'bottom',
    },
    {
      title: '搜索与新建任务',
      description: '支持按标题或描述模糊搜索；点击“新建任务”可直接在此视角下快速创建新任务。',
      target: () => document.querySelector('[data-tour="my-tasks-actions"]') as HTMLElement,
      placement: 'bottomLeft',
    },
    {
      title: '列头排序与任务详情',
      description: '点击任意带有箭头的表头（如截止时间、优先级、状态等），即可一键正序/倒序排列任务；点击任意任务行可快速滑出右侧详情面板。',
      target: () =>
        (document.querySelector('[data-tour~="my-tasks-table-header"]') ||
          document.querySelector('[data-tour="my-tasks-table-header"]')) as HTMLElement,
      placement: 'bottom',
    },
  ];

  const teamSettingsSteps: TourProps['steps'] = [
    {
      title: '团队基础资料',
      description: '查看并维护团队名称、所属层级（公司/部门/团队/小组/项目）与定位描述。管理员可点击右上角“编辑”进行内联修改与保存。',
      target: () => document.querySelector('[data-tour="team-settings-basic"]') as HTMLElement,
      placement: 'bottom',
    },
    {
      title: '钉钉群定时提醒',
      description: '支持绑定钉钉自定义机器人，设定每个工作日定点自动推送未完成任务催办，精准 @ 相关负责人并支持即时测试发送。',
      target: () => document.querySelector('[data-tour="team-settings-reminder"]') as HTMLElement,
      placement: 'bottom',
    },
    {
      title: '团队任务可见范围',
      description: '团队权限总控。可切换“全员共享任务清单”、“成员仅见相关任务”，或开启“个性化单独设置”针对特定成员定制查阅范围。',
      target: () => document.querySelector('[data-tour="team-settings-visibility"]') as HTMLElement,
      placement: 'bottom',
    },
    {
      title: '成员架构与角色管理',
      description: '快速从通讯录添加新成员，为成员分配管理员或普通角色，支持成员个性化权限配置与未完成任务安全交接移除。',
      target: () => document.querySelector('[data-tour="team-settings-members"]') as HTMLElement,
      placement: 'bottom',
    },
  ];

  const teamWorkspaceSteps: TourProps['steps'] = [
    {
      title: '团队空间与层级',
      description: '展示当前团队名称与所属组织层级（如部门级、项目级），快速明确当前所处空间上下文。',
      target: () => document.querySelector('[data-tour="team-workspace-title"]') as HTMLElement,
      placement: 'bottom',
    },
    {
      title: '团队管理与设置',
      description: '点击进入团队管理后台。支持维护团队基础资料、配置钉钉群定时提醒、管理成员角色与调整任务数据可见范围。',
      target: () => document.querySelector('[data-tour="team-workspace-settings"]') as HTMLElement,
      placement: 'bottomRight',
    },
    {
      title: '多视图协同模式',
      description: '支持在【列表视图】、【看板视图】与【日历视图】之间自由切换，满足结构化排期、看板拖拽推进与交付节点追踪等不同场景。',
      target: () => document.querySelector('[data-tour="team-workspace-views"]') as HTMLElement,
      placement: 'bottom',
    },
    {
      title: '综合筛选与快捷操作',
      description: '支持按任务状态与截止日期范围精准过滤，可快速关键词搜索、一键导出 Excel 报表或直接新建团队任务。',
      target: () => document.querySelector('[data-tour="team-workspace-toolbar"]') as HTMLElement,
      placement: 'bottom',
    },
    {
      title: '列头排序与任务详情',
      description: '点击任意带有箭头的表头（如截止时间、优先级、状态等）即可一键排序；支持父子任务树形折叠，点击任务行可在右侧抽屉展开全功能协作面板。',
      target: () =>
        (document.querySelector('[data-tour~="team-workspace-table-header"]') ||
          document.querySelector('[data-tour~="workbench-table-header"]') ||
          document.querySelector('[data-tour="team-workspace-table-header"]')) as HTMLElement,
      placement: 'bottom',
    },
  ];

  const trashSteps: TourProps['steps'] = [
    {
      title: '搜索已删除任务',
      description: '支持按任务名称或原描述进行关键词模糊检索，快速定位需要找回的历史任务。',
      target: () => document.querySelector('[data-tour="trash-search"]') as HTMLElement,
      placement: 'bottomLeft',
    },
    {
      title: '删除记录与快照查阅',
      description: '表格完整保留任务删除前的团队归属、负责人及删除时间。点击任意任务行可查看详情、历史讨论与附件。',
      target: () =>
        (document.querySelector('[data-tour~="trash-table-header"]') ||
          document.querySelector('[data-tour~="workbench-table-header"]')) as HTMLElement,
      placement: 'bottom',
    },
    {
      title: '一键恢复任务',
      description: '点击“恢复任务”即可将任务完整恢复至原本所属的团队空间或个人工作台，数据与协同状态无缝还原。',
      target: () =>
        (document.querySelector('[data-tour="trash-restore-action"]') ||
          document.querySelector('[data-tour~="trash-table-header"]')) as HTMLElement,
      placement: 'left',
    },
  ];

  const teamsSteps: TourProps['steps'] = [
    {
      title: '创建协同团队',
      description: '点击可创建全新的团队空间，设定团队层级（公司/部门/团队/小组/项目），指派管理员并批量引入成员。',
      target: () => document.querySelector('[data-tour="teams-create-action"]') as HTMLElement,
      placement: 'bottomLeft',
    },
    {
      title: '团队归属清晰分流',
      description: '清晰区分【我创建的团队】（拥有最高管理权限）与【我参与的团队】（协同处理分配任务），方便分类聚焦。',
      target: () => document.querySelector('[data-tour="teams-sections"]') as HTMLElement,
      placement: 'bottom',
    },
    {
      title: '团队卡片与空间直达',
      description: '卡片直观呈现团队层级、当前成员总数与活跃任务数。点击任意卡片即可直接进入专属团队任务空间。',
      target: () =>
        (document.querySelector('[data-tour="teams-card-item"]') ||
          document.querySelector('[data-tour="teams-sections"]')) as HTMLElement,
      placement: 'bottom',
    },
  ];

  const steps =
    tourType === 'my-tasks'
      ? myTasksSteps
      : tourType === 'team-settings'
      ? teamSettingsSteps
      : tourType === 'team-workspace'
      ? teamWorkspaceSteps
      : tourType === 'trash'
      ? trashSteps
      : tourType === 'teams'
      ? teamsSteps
      : globalSteps;

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#18181B', // 契合 shadcn/zinc 质感主色
          borderRadius: 8,
        },
      }}
    >
      <Tour
        open={open}
        current={currentStep}
        onChange={setCurrentStep}
        onClose={handleClose}
        steps={steps}
        gap={{ offset: 6, radius: 8 }}
      />
    </ConfigProvider>
  );
}
