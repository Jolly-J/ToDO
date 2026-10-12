/** 应用根组件，定义全局路由结构与各页面入口 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import AuthGuard from '@/components/auth/AuthGuard';
import AdminGuard from '@/components/auth/AdminGuard';
import ReleaseExperience from '@/features/release/ReleaseExperience';

// 页面组件
import Dashboard from '@/pages/Dashboard';
import MyTasks from '@/pages/MyTasks';
import Teams from '@/pages/Teams';
import TeamDetail from '@/pages/Teams/TeamDetail';
import TeamSettings from '@/pages/Teams/TeamSettings';
import Tasks from '@/pages/Tasks';
import Notifications from '@/pages/Notifications';
import Trash from '@/pages/Trash';
import AvatarPlayground from '@/pages/AvatarPlayground';
import Login from '@/pages/Login';
import AdminOverviewPage from '@/pages/Admin';
import AdminLayout from '@/pages/Admin/layout';
import SystemPage from '@/pages/Admin/SystemPage';
import DataPage from '@/pages/Admin/DataPage';
import AuditPage from '@/pages/Admin/AuditPage';
import EnvironmentPage from '@/pages/Admin/EnvironmentPage';
import DingtalkPushPage from '@/pages/Admin/DingtalkPushPage';
import DingtalkPushRecordsPage from '@/pages/Admin/DingtalkPushRecordsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <AuthGuard>
              <AdminGuard>
                <AdminLayout />
              </AdminGuard>
            </AuthGuard>
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="environment" element={<EnvironmentPage />} />
          <Route path="dingtalk-push" element={<DingtalkPushPage />} />
          <Route path="dingtalk-push-records" element={<DingtalkPushRecordsPage />} />
        </Route>
        <Route
          path="/"
          element={
            <AuthGuard>
              <MainLayout />
            </AuthGuard>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="my-tasks" element={<MyTasks />} />
          <Route path="teams" element={<Teams />} />
          <Route path="teams/:id" element={<TeamDetail />} />
          <Route path="teams/:id/settings" element={<TeamSettings />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="trash" element={<Trash />} />
          <Route path="avatar-playground" element={<AvatarPlayground />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <ReleaseExperience />
    </BrowserRouter>
  );
}

export default App;
