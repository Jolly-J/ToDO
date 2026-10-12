/**
 * layout.tsx - Admin 布局组件
 *
 * 提供 Admin 后台的整体布局框架，包含顶部导航栏、权限验证、会话管理、
 * 路由出口等功能，是所有 Admin 子页面的容器组件。
 *
 * @module pages/Admin
 */
import { type CSSProperties, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, ClipboardList, History, LogOut, Megaphone, MonitorCog, ScrollText, ShieldCheck } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store';
import { fetchAdminSession } from './api';
import type { AdminLayoutContextValue, AdminSessionInfo } from './types';
import styles from './Admin.module.css';
const navigationGroups = [
  {
    label: '运行与审计',
    items: [
      { label: '运行总览', to: '/admin', end: true, icon: Activity },
      { label: '审计中心', to: '/admin/audit', icon: ScrollText },
      { label: '环境诊断', to: '/admin/environment', icon: MonitorCog },
    ],
  },
  {
    label: '业务治理',
    items: [
      { label: '任务治理', to: '/admin/data', icon: ClipboardList },
      { label: '钉钉推送', to: '/admin/dingtalk-push', icon: Megaphone },
      { label: '发送记录', to: '/admin/dingtalk-push-records', icon: History },
    ],
  },
  {
    label: '组织与权限',
    items: [
      { label: '系统管理', to: '/admin/system', icon: ShieldCheck },
    ],
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [session, setSession] = useState<AdminSessionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    setSessionLoading(true);
    setSessionError(null);

    void fetchAdminSession()
      .then((data) => {
        if (!cancelled) {
          setSession(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSessionError(String(error?.response?.data?.message || error?.message || '管理员会话校验失败'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSessionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const outletContext: AdminLayoutContextValue = {
    session,
    sessionLoading,
    sessionError,
  };

  return (
    <div className={styles.page}>
      <TooltipProvider>
        <SidebarProvider
          data-testid="admin-layout-canvas"
          className="flex-1 bg-white"
          style={{
            '--sidebar-width': '11.5625rem',
            '--sidebar': '#F9FAFB',
            '--sidebar-foreground': '#37352F',
            '--sidebar-accent': '#EFEFEF',
            '--sidebar-accent-foreground': '#37352F',
            '--sidebar-border': '#F1F1EF',
            '--sidebar-ring': '#D6D3D1',
          } as CSSProperties}
        >
          <Sidebar collapsible="none" className="border-r border-[#F1F1EF]">
            <SidebarHeader className="px-4 pb-3 pt-5">
              <div className="flex flex-col items-start gap-2 overflow-hidden">
                <img src="/ToDO横向logo.svg" alt="ToDo" className="h-9 w-auto max-w-full object-contain" />
                <Badge variant="secondary" className="rounded-md px-2 text-[10px]">管理后台</Badge>
              </div>
            </SidebarHeader>

            <SidebarContent className="px-1 py-2">
              {navigationGroups.map((group) => (
                <SidebarGroup key={group.label}>
                  <SidebarGroupLabel className="text-[10px] font-medium text-[#9B9A97]">{group.label}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map(({ label, to, end, icon: Icon }) => (
                        <SidebarMenuItem key={to}>
                          <NavLink to={to} end={end} className="block">
                            {({ isActive }) => (
                              <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                tooltip={label}
                                className="rounded-md font-medium text-[#787774] hover:bg-[#EFEFEF] hover:text-[#37352F] data-active:bg-[#EFEFEF] data-active:text-[#37352F]"
                              >
                                <span>
                                  <Icon />
                                  <span>{label}</span>
                                </span>
                              </SidebarMenuButton>
                            )}
                          </NavLink>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>

            <SidebarFooter className="border-t border-[#F1F1EF] p-2">
              <div className="px-2 py-1.5 text-[11px] text-[#9B9A97]">
                {sessionLoading ? '正在确认管理员会话' : sessionError ? '管理员会话异常' : '管理员会话已验证'}
              </div>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="返回业务端" onClick={() => navigate('/dashboard')} className="text-[#787774] hover:bg-[#EFEFEF] hover:text-[#37352F]">
                    <ArrowLeft />
                    <span>返回业务端</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="退出登录"
                    onClick={() => {
                      logout();
                      navigate('/login', { replace: true });
                    }}
                    className="text-[#787774] hover:bg-[#EFEFEF] hover:text-[#37352F]"
                  >
                    <LogOut />
                    <span>退出登录</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset className="min-h-0 bg-white">
            <div className={`${styles.mainContent} flex min-h-0 w-full flex-1 flex-col overflow-hidden px-6 py-5 lg:px-8 lg:py-6`}>
              <Outlet context={outletContext} />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  );
}
