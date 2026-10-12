/**
 * 页面名称：通知中心
 * 文件作用：集中展示系统消息与任务提醒。
 * 主要功能：查看通知列表、标记单条通知已读，以及一键全部已读。
 */
import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { useNotificationStore } from '@/store';
import dayjs from 'dayjs';
import { pageHeaderStyles } from '@/pages/pageHeaderStyles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Notifications() {
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div>
      <div style={pageHeaderStyles.toolbar}>
        <div style={pageHeaderStyles.titleBlock}>
          <div style={pageHeaderStyles.detailTitleRow}>
            <h2 style={pageHeaderStyles.title}>通知中心</h2>
            {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
          </div>
          <p style={pageHeaderStyles.meta}>集中处理与你相关的系统消息与任务提醒</p>
        </div>
        <div style={pageHeaderStyles.actions}>
          {unreadCount > 0 && (
            <Button variant="link" onClick={markAllAsRead} className="px-0">
              <Check className="h-4 w-4" />
              全部已读
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-2xl p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-14 rounded-lg bg-muted" />
            <div className="h-14 rounded-lg bg-muted" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">暂无通知</div>
        ) : (
          <ul className="space-y-2">
            {notifications.map((item) => (
              <li
                key={item.id}
                className="cursor-pointer rounded-lg p-4"
                style={{ background: item.is_read ? undefined : '#F0F7FF' }}
                onClick={() => !item.is_read && markAsRead(item.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.title}</span>
                  <span style={{ color: '#9CA3AF', fontSize: 12 }}>
                    {dayjs(item.created_at).tz('Asia/Shanghai').format('MM-DD HH:mm')}
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{item.content}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
