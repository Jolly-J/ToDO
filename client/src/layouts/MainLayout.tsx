/**
 * 布局名称：主布局
 * 文件作用：组织登录后的整体页面框架。
 * 主要功能：固定左侧导航栏，并在右侧内容区承载各业务页面。
 */
import { useCallback, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sider from './Sider';
import MobileTabBar from './MobileTabBar'; // [MOBILE ONLY]
import {
  APP_SIDER_WIDTH,
  DESKTOP_CONTENT_MIN_WIDTH,
  MOBILE_TABBAR_HEIGHT,
  MOBILE_PAGE_PADDING,
} from './layoutTokens';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store';
import { useIsMobile } from '@/hooks/useIsMobile'; // [MOBILE ONLY]
import AppTour from '@/components/onboarding/AppTour';
import { useTourStore } from '@/components/onboarding/tourStore';

const POLL_INTERVAL = 30000;

export default function MainLayout() {
  const isMobile = useIsMobile(); // [MOBILE ONLY] 探测是否为移动端
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);
  const user = useAuthStore((state) => state.user);
  const checkAutoStart = useTourStore((state) => state.checkAutoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isMobile && user?.id) {
      checkAutoStart(user.id);
    }
  }, [isMobile, user?.id, checkAutoStart]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);
  }, [fetchUnreadCount]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    startPolling();

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchUnreadCount();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchUnreadCount, startPolling, stopPolling]);

  return (
    <div
      className={`flex bg-white ${isMobile ? 'min-h-screen' : 'h-screen overflow-hidden'}`}
      data-layout-mode={isMobile ? 'mobile' : 'desktop'}
    >
      {/* 
        [MOBILE ONLY] 
        根据设备环境决定导航模式：
        - 桌面端：显示左侧固定 Sider
        - 移动端：显示底部 MobileTabBar
      */}
      {!isMobile ? <Sider /> : <MobileTabBar />}

      {/* 内容区 */}
      <div
        data-testid="main-layout-shell"
        className={`flex min-w-0 flex-1 flex-col bg-white ${isMobile ? '' : 'h-screen min-h-0 overflow-hidden'}`}
        style={{ 
          // [MOBILE ONLY] 桌面端需要留出侧边栏宽度，移动端则全宽显示
          marginLeft: isMobile ? 0 : `var(--tf-density-sider-width, ${APP_SIDER_WIDTH}px)`,
          // [MOBILE ONLY] 移动端底部需要留出 TabBar 的避让空间
          paddingBottom: isMobile ? MOBILE_TABBAR_HEIGHT : 0 
        }}
      >
        <main
          data-testid="main-layout-content"
          className={isMobile
            ? 'min-w-0 overflow-x-hidden overflow-y-auto'
            : 'min-h-0 min-w-0 flex-1 overflow-auto'}
          style={{
            // 移动端沿用自然页面流；桌面端把间距放进滚动容器内部。
            margin: isMobile
              ? `${MOBILE_PAGE_PADDING}px` 
              : 0,
            padding: isMobile
              ? 0
              : 'var(--tf-density-page-margin, 32px 48px 48px)',
            minHeight: isMobile
              ? `calc(100vh - ${MOBILE_TABBAR_HEIGHT}px)`
              : 0,
          }}
        >
          <div
            data-testid="main-layout-canvas"
            style={isMobile
              ? undefined
              : {
                  minWidth: DESKTOP_CONTENT_MIN_WIDTH,
                  minHeight: '100%',
                }}
          >
            <Outlet />
          </div>
        </main>
      </div>
      {!isMobile && <AppTour />}
    </div>
  );
}
