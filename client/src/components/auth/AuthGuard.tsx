/**
 * 组件名称：登录态守卫
 * 文件作用：保护需要登录后才能访问的页面。
 * 主要功能：校验 token、补拉当前用户信息，并在未登录时跳转到登录页。
 */
import { Navigate, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useAuthStore } from '@/store';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation();
  const { token, user, loading, fetchMe } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      void fetchMe();
    }
  }, [token, user, fetchMe]);

  if (token && !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!loading && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
