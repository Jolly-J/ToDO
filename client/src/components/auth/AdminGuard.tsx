/**
 * 管理员权限守卫组件
 * 校验当前用户是否具备管理员角色，未授权时重定向至首页
 */
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import request from '@/api/request';
import { useAuthStore } from '@/store';

interface AdminGuardProps {
  children: React.ReactNode;
}

interface AdminSessionInfo {
  userId: string;
  isAdmin: boolean;
  roleCodes: string[];
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const location = useLocation();
  const { token, user, loading, fetchMe, logout } = useAuthStore();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    if (!token) {
      setStatus('denied');
      return;
    }

    if (!user) {
      void fetchMe();
      setStatus('checking');
      return;
    }

    let cancelled = false;
    setStatus('checking');

    void request
      .get<AdminSessionInfo>('/admin/session')
      .then((session) => {
        if (cancelled) {
          return;
        }

        if (session?.isAdmin && session.userId === user.id) {
          setStatus('allowed');
          return;
        }

        logout();
        setStatus('denied');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        logout();
        setStatus('denied');
      });

    return () => {
      cancelled = true;
    };
  }, [token, user, fetchMe, logout]);

  if (loading || status === 'checking') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <span style={{ fontSize: 14, color: '#6b7280' }}>正在校验管理员会话...</span>
      </div>
    );
  }

  if (!token || status === 'denied') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
