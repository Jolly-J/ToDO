/**
 * 通知预览面板
 *
 * 桌面端作为任务详情标题栏中的聚合通知入口，通过 Popover 展示本轮修改；
 * 移动端继续使用顶部“灵动岛”。
 */
import { AnimatePresence, motion } from 'motion/react';
import { Bell, Check, Send, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ChangeItem } from '@/hooks/useNotificationPreview';

interface NotificationPreviewPanelProps {
  visible: boolean;
  sent: boolean;
  changes: ChangeItem[];
  recipients: string[];
  countdown: number;
  countdownMax: number;
  onSend: () => void;
  onDismiss?: () => void;
  isMobile?: boolean; // [MOBILE ONLY] 是否开启灵动岛模式
}

export default function NotificationPreviewPanel({
  visible,
  sent,
  changes,
  recipients,
  countdown,
  countdownMax,
  onSend,
  onDismiss,
  isMobile = false, // [MOBILE ONLY]
}: NotificationPreviewPanelProps) {
  // [MOBILE ONLY] 灵动岛模式
  if (isMobile) {
    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="flex items-center gap-3 bg-[#1A1A1A] text-white px-4 py-2.5 rounded-full shadow-2xl pointer-events-auto min-w-[220px] border border-white/10"
          >
            {sent ? (
              <>
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Check className="size-4 shrink-0 text-green-400" />
                  <span className="text-[10px] font-bold leading-tight truncate">
                    已发送 {changes.length} 项修改通知
                  </span>
                </div>
                {onDismiss ? (
                  <button
                    onClick={onDismiss}
                    className="text-white/60 hover:text-white active:scale-90 transition-all shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="relative size-5 shrink-0">
                    <Progress
                      value={(countdown / countdownMax) * 100}
                      className="absolute inset-0 h-full w-full rounded-full bg-white/10"
                    />
                    <Bell className="absolute inset-0 size-3 m-auto text-white" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold leading-tight truncate">
                      {changes.length} 项修改将通知
                    </span>
                    <span className="text-[9px] text-white/60 leading-tight">
                      {countdown}s 后自动发送
                    </span>
                  </div>
                </div>
                <button
                  onClick={onSend}
                  className="bg-white text-black text-[11px] font-bold px-4 py-1.5 rounded-full active:scale-90 transition-transform shrink-0"
                >
                  发送
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (!visible) return null;

  const progressValue = countdownMax > 0 ? (countdown / countdownMax) * 100 : 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          aria-label={sent ? '查看已发送的聚合通知' : `查看 ${changes.length} 项待发送变更`}
          className={sent
            ? 'inline-flex h-8 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100'
            : 'inline-flex h-8 items-center gap-2 rounded-lg border border-(--tf-border) bg-(--tf-background-soft) px-3 text-[12px] font-medium text-(--tf-foreground) transition-colors hover:bg-(--tf-card)'}
        >
          {sent ? <Check className="size-3.5" aria-hidden="true" /> : <Bell className="size-3.5" aria-hidden="true" />}
          <span className="whitespace-nowrap">
            {sent ? '通知已发送' : `${changes.length} 项变更待发送`}
          </span>
          {!sent ? (
            <span className="rounded-md bg-(--tf-background) px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {countdown}s
            </span>
          ) : null}
        </motion.button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={10} className="w-[320px] overflow-hidden p-0 shadow-lg">
        <div className="border-b border-(--tf-border-soft) px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-(--tf-foreground)">
              {sent ? <Check className="size-4 text-emerald-600" aria-hidden="true" /> : <Bell className="size-4 text-(--tf-subtle-foreground)" aria-hidden="true" />}
              {sent ? '聚合通知已发送' : '聚合通知待发送'}
            </div>
            {!sent ? <span className="text-[11px] tabular-nums text-muted-foreground">{countdown}s 后自动发送</span> : null}
          </div>
          {!sent ? <Progress value={progressValue} className="mt-3 h-1.5" /> : null}
        </div>

        <div className="max-h-[260px] space-y-4 overflow-y-auto px-4 py-3.5">
          <div>
            <div className="mb-2 text-[11px] font-medium text-(--tf-subtle-foreground)">本轮修改</div>
            <ul className="space-y-1.5">
              {changes.map((item) => (
                <li key={item.field} className="flex items-center gap-2 text-[12px] text-(--tf-foreground)">
                  <span className="size-1.5 shrink-0 rounded-full bg-(--tf-primary)" />
                  <span>{item.count && item.count > 1 ? `${item.label} ${item.count} 条` : item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-medium text-(--tf-subtle-foreground)">将通知</div>
            <div className="flex flex-wrap gap-1.5">
              {recipients.map((role) => (
                <Badge key={role} variant="outline" className="font-normal">{role}</Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-(--tf-border-soft) bg-(--tf-background-soft) px-4 py-3">
          {sent ? (
            onDismiss ? (
              <Button size="sm" variant="outline" onClick={onDismiss}>
                <X className="size-3.5" />
                关闭提示
              </Button>
            ) : null
          ) : (
            <Button size="sm" onClick={onSend}>
              <Send className="size-3.5" />
              立即发送
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
