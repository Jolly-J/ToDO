/**
 * 布局名称：应用侧边栏
 * 文件作用：提供系统主导航、团队快捷入口和用户菜单。
 * 主要功能：切换核心页面、进入团队空间、触发创建团队和退出登录。
 */
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Plus,
  Trash2,
  ShieldCheck,
  User,
  LogOut,
  Palette,
  HelpCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTourStore } from '@/components/onboarding/tourStore';
import CreateTaskModal from '@/components/task/form/CreateTaskModal';
import CreateTeamModal from '@/components/team/CreateTeamModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTeamStore, useAuthStore, useTaskStore } from '@/store';
import request from '@/api/request';
import {
  APP_SIDER_HORIZONTAL_PADDING,
  APP_SIDER_LOGO_HORIZONTAL_PADDING,
  APP_SIDER_WIDTH,
} from './layoutTokens';

interface AdminSessionInfo {
  userId: string;
  isAdmin: boolean;
  roleCodes: string[];
}

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  dataTour?: string;
}

interface TaskPageMeta {
  total: number;
}

const navItemClassName =
  'tf-sider-nav-item flex w-full items-center rounded-md font-medium transition-colors';

function getNavItemClass(active: boolean) {
  return active
    ? `${navItemClassName} bg-[#EFEFEF] text-[#37352F]`
    : `${navItemClassName} text-[#787774] hover:bg-[#EFEFEF] hover:text-[#37352F]`;
}

function formatNavBadge(count?: number) {
  const value = Number(count || 0);
  if (value <= 0) return '';
  return value > 99 ? '99+' : String(value);
}

function NavBadge({ count }: { count?: number }) {
  const label = formatNavBadge(count);
  if (!label) return null;

  return (
    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#EF4444] px-1.5 text-[11px] font-semibold leading-none text-white">
      {label}
    </span>
  );
}

export default function Sider() {
  const navigate = useNavigate();
  const location = useLocation();
  const { teams, fetchTeams } = useTeamStore();
  const { user, logout } = useAuthStore();
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const openTour = useTourStore((state) => state.openTour);
  const [createTaskModalVisible, setCreateTaskModalVisible] = useState(false);
  const [createTeamModalVisible, setCreateTeamModalVisible] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [myUnfinishedCount, setMyUnfinishedCount] = useState(0);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const refreshMyUnfinishedCount = useCallback(async () => {
    if (!user?.id) {
      setMyUnfinishedCount(0);
      return;
    }

    try {
      const data = await request.get<TaskPageMeta>('/my-tasks?scope=assigned&status=unfinished');
      setMyUnfinishedCount(Number(data.total || 0));
    } catch {
      setMyUnfinishedCount(0);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshMyUnfinishedCount();
  }, [refreshMyUnfinishedCount]);

  useEffect(() => {
    if (!user?.id) {
      setHasAdminAccess(false);
      return;
    }

    let cancelled = false;

    void request
      .get<AdminSessionInfo>('/admin/session')
      .then((session) => {
        if (cancelled) {
          return;
        }

        setHasAdminAccess(Boolean(session?.isAdmin && session.userId === user.id));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setHasAdminAccess(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const activeTeamId = useMemo(() => {
    const teamRouteMatch = location.pathname.match(/^\/teams\/([^/]+)/);
    if (teamRouteMatch?.[1]) {
      return decodeURIComponent(teamRouteMatch[1]);
    }

    if (location.pathname === '/tasks') {
      return new URLSearchParams(location.search).get('teamId') || '';
    }

    return '';
  }, [location.pathname, location.search]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const fixedItems: NavItem[] = [
    { key: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, label: '驾驶舱', dataTour: 'nav-dashboard' },
    { key: '/my-tasks', icon: <CheckSquare className="h-4 w-4" />, label: '我的任务', badge: myUnfinishedCount, dataTour: 'nav-my-tasks' },
    { key: '/teams', icon: <Users className="h-4 w-4" />, label: '我的团队', dataTour: 'nav-teams' },
  ];

  const teamItems: NavItem[] = teams.map((team) => ({
    key: `/teams/${team.id}`,
    icon: <Users className="h-4 w-4" />,
    label: team.name,
  }));

  const bottomItems: NavItem[] = [
    { key: 'create-task', icon: <Plus className="h-4 w-4" />, label: '创建任务', dataTour: 'action-create-task' },
    { key: 'create-team', icon: <Plus className="h-4 w-4" />, label: '创建 Team', dataTour: 'action-create-team' },
    { key: '/trash', icon: <Trash2 className="h-4 w-4" />, label: '回收站' },
  ];

  const handleBottomMenuClick = (key: string) => {
    if (key === 'create-task') {
      setCreateTaskModalVisible(true);
      return;
    }

    if (key === 'create-team') {
      setCreateTeamModalVisible(true);
      return;
    }

    navigate(key);
  };

  return (
    <div
      data-testid="app-sider"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        width: `var(--tf-density-sider-width, ${APP_SIDER_WIDTH}px)`,
        background: '#F9FAFB',
        borderRight: 'none',
      }}
    >
      <div
        data-testid="sider-brand"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: `var(--tf-density-sider-brand-padding-y, 24px) var(--tf-density-sider-logo-padding-x, ${APP_SIDER_LOGO_HORIZONTAL_PADDING}px)`,
          marginBottom: 'var(--tf-density-sider-brand-margin-bottom, 8px)',
        }}
      >
        <img
          src="/ToDO横向logo.svg"
          alt="ToDo logo"
          style={{
            height: 'var(--tf-density-sider-logo-height, 46px)',
            display: 'block',
          }}
        />
      </div>

      <div
        data-testid="sider-content-shell"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: `0 var(--tf-density-sider-padding-x, ${APP_SIDER_HORIZONTAL_PADDING}px)`,
        }}
      >
        <div data-testid="primary-nav-section" style={{ flexShrink: 0 }} className="space-y-1">
          {fixedItems.map((item) => {
            const active = location.pathname === item.key;
            return (
              <button
                key={item.key}
                type="button"
                data-tour={item.dataTour}
                className={getNavItemClass(active)}
                onClick={() => navigate(item.key)}
              >
                {item.icon}
                <span>{item.label}</span>
                <NavBadge count={item.badge} />
              </button>
            );
          })}
        </div>

        <div
          style={{
            margin: '10px 0 8px',
            borderTop: '1px solid #F1F1EF',
          }}
        />

        <div
          data-testid="team-shortcut-section"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            paddingBottom: 8,
          }}
        >
          <div
            data-tour="team-shortcuts"
            style={{
              padding: '0 4px 8px',
              color: '#9B9A97',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            团队快捷入口
          </div>
          <div className="space-y-1">
            {teamItems.map((item) => {
              const active = location.pathname === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={getNavItemClass(active)}
                onClick={() => navigate(item.key)}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: `8px var(--tf-density-sider-padding-x, ${APP_SIDER_HORIZONTAL_PADDING}px)`, marginTop: 'auto' }} className="space-y-1">
        {bottomItems.map((item) => {
          const active = location.pathname === item.key;
          return (
            <button
              key={item.key}
              type="button"
              data-tour={item.dataTour}
              className={getNavItemClass(active)}
              onClick={() => handleBottomMenuClick(item.key)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-tour="user-profile"
            className="tf-sider-user-menu flex items-center rounded-lg transition-colors hover:bg-[#EFEFEF]"
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src={user?.avatar || undefined} alt={user?.name || '用户'} />
              <AvatarFallback>
                {user?.name?.slice(0, 1) || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium text-[#37352F]">{user?.name || '用户'}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => navigate('/avatar-playground')}>
            <Palette className="h-4 w-4" />
            头像游乐场
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openTour()}>
            <HelpCircle className="h-4 w-4" />
            新手引导
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {hasAdminAccess ? (
            <>
              <DropdownMenuItem onClick={() => navigate('/admin')}>
                <ShieldCheck className="h-4 w-4" />
                管理后台
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem variant="destructive" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateTaskModal
        initialTeamId=""
        teamMode="optional"
        visible={createTaskModalVisible}
        onClose={() => setCreateTaskModalVisible(false)}
        onSuccess={() => {
          setCreateTaskModalVisible(false);
          refreshMyUnfinishedCount();
          fetchTeams();
          if (activeTeamId) {
            fetchTasks(activeTeamId);
          }
        }}
      />

      <CreateTeamModal
        visible={createTeamModalVisible}
        onClose={() => setCreateTeamModalVisible(false)}
        onSuccess={() => {
          setCreateTeamModalVisible(false);
          fetchTeams();
        }}
      />
    </div>
  );
}
