import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Users, Bell } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { MOBILE_TABBAR_HEIGHT } from './layoutTokens';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store';
import request from '@/api/request';

interface TaskPageMeta {
  total: number;
}

/**
 * 移动端底部导航栏 (MOBILE ONLY)
 * 作用：替代桌面端的 Sider，提供核心页面的快速切换。
 */
export default function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const { user } = useAuthStore();
  const [myUnfinishedCount, setMyUnfinishedCount] = useState(0);

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

  const navItems = [
    { key: '/dashboard', label: '概览', icon: <LayoutDashboard size={20} /> },
    { key: '/my-tasks', label: '任务', icon: <CheckSquare size={20} />, badge: myUnfinishedCount },
    { key: '/notifications', label: '通知', icon: <Bell size={20} />, badge: unreadCount },
    { key: '/teams', label: '团队', icon: <Users size={20} /> },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-[#E9E9E7] bg-white pb-safe" // [MOBILE ADAPTATION] 移除 shadow，使用规范边框色
      style={{ height: MOBILE_TABBAR_HEIGHT }}
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.key;
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.key)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
              isActive ? 'text-[#37352F]' : 'text-[#787774]'
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute right-[25%] top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
