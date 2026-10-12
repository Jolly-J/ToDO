import { Check } from 'lucide-react';
import type { TaskReminderRule } from '@/types';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/useIsMobile'; // [MOBILE ONLY]
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export const reminderOptions: { label: string; value: TaskReminderRule }[] = [
  { label: '截止前 15 分钟', value: 'due_15m' },
  { label: '截止前 30 分钟', value: 'due_30m' },
  { label: '截止前 1 小时', value: 'due_1h' },
  { label: '截止前 3 小时', value: 'due_3h' },
  { label: '截止前 1 天', value: 'due_1d' },
  { label: '截止前 3 天', value: 'due_3d' },
  { label: '不提醒', value: 'none' },
];

export const periodicIntervalOptions = [
  { label: '每天', value: 1 },
  { label: '每 2 天', value: 2 },
  { label: '每 3 天', value: 3 },
  { label: '每 5 天', value: 5 },
  { label: '每周', value: 7 },
  { label: '每两周', value: 14 },
  { label: '不重复', value: 0 },
];

interface CompoundReminderSettingProps {
  // 一次性提醒
  reminderRule?: TaskReminderRule | null;
  onReminderRuleChange: (rule: TaskReminderRule | null) => void;
  // 周期提醒
  periodicIntervalDays?: number | null;
  periodicTime?: string | null;
  onPeriodicChange: (interval: number | null, time: string | null) => void;
  onClose?: () => void;
}

/**
 * [MOBILE ADAPTATION] 复合提醒设置组件
 * 增加了移动端响应式布局，防止横向和纵向溢出。
 */
export function CompoundReminderSetting({
  reminderRule,
  onReminderRuleChange,
  periodicIntervalDays,
  periodicTime,
  onPeriodicChange,
  onClose,
}: CompoundReminderSettingProps) {
  const isMobile = useIsMobile(); // [MOBILE ONLY]

  return (
    <div 
      className={cn(
        "flex flex-col p-1.5 overflow-y-auto custom-scrollbar w-max",
        isMobile && "w-full max-w-full pb-8" // [MOBILE ADAPTATION] 取消固定最大宽度，增加底部留白
      )} 
      style={isMobile ? { maxHeight: '75dvh' } : { maxHeight: 'var(--radix-popover-content-available-height)' }}
    >
      <div className={cn("flex gap-3", isMobile && "flex-col gap-6")}>
        {/* 模块1：到期提醒 */}
        <div className={cn("w-48 flex flex-col gap-1", isMobile && "w-full px-2")}>
          <div className="mb-1 px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--tf-subtle-foreground)">
            一次性到期提醒
          </div>
          <div className="space-y-0.5">
            {reminderOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-(--tf-card) hover:text-(--tf-foreground)"
                onClick={() => {
                  onReminderRuleChange(option.value === 'none' ? null : option.value);
                }}
              >
                <span>{option.label}</span>
                {(reminderRule === option.value || (!reminderRule && option.value === 'none')) ? (
                  <Check className="h-4 w-4 text-(--tf-foreground)" />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {!isMobile && <Separator orientation="vertical" className="h-auto" />}

        {/* 模块2：周期督办提醒 */}
        <div className={cn("w-48 flex flex-col gap-1", isMobile && "w-full px-2")}>
          <div className="mb-1 px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--tf-subtle-foreground)">
            循环周期提醒
          </div>
          <div className="space-y-0.5">
            {periodicIntervalOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-(--tf-card) hover:text-(--tf-foreground)"
                onClick={() => {
                  if (option.value === 0) {
                    onPeriodicChange(null, null);
                  } else {
                    // 默认时间 09:00
                    onPeriodicChange(option.value, periodicTime || '09:00');
                  }
                }}
              >
                <span>{option.label}</span>
                {(Number(periodicIntervalDays || 0) === option.value) ? (
                  <Check className="h-4 w-4 text-(--tf-foreground)" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Separator className="my-2 mx-1" />
      
      {/* 提醒时刻设置 */}
      <div className="px-3 flex items-center justify-between pb-2 mt-1">
        <span className="text-[12px] font-medium text-(--tf-foreground)">提醒时刻</span>
        <div className="flex items-center gap-1">
          <Select
            value={(periodicTime || '09:00').split(':')[0]}
            onValueChange={(h) => {
              const m = (periodicTime || '09:00').split(':')[1] || '00';
              onPeriodicChange(periodicIntervalDays || null, `${h}:${m}`);
            }}
          >
            <SelectTrigger className="h-7 w-16 px-2 text-[12px] border-(--tf-border) bg-(--tf-card) shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-1700">
              {HOURS.map((h) => (
                <SelectItem key={h} value={h} className="text-[12px]">{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[12px] text-(--tf-foreground)">:</span>
          <Select
            value={(periodicTime || '09:00').split(':')[1] || '00'}
            onValueChange={(m) => {
              const h = (periodicTime || '09:00').split(':')[0] || '09';
              onPeriodicChange(periodicIntervalDays || null, `${h}:${m}`);
            }}
          >
            <SelectTrigger className="h-7 w-16 px-2 text-[12px] border-(--tf-border) bg-(--tf-card) shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-1700">
              {MINUTES.map((m) => (
                <SelectItem key={m} value={m} className="text-[12px]">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {onClose && (
        <div className="flex justify-end px-1 pb-0.5 mt-2">
            <button
              type="button"
              className="text-[12px] font-medium text-(--tf-foreground) transition-colors hover:text-primary p-2"
              onClick={onClose}
            >
              完成设置
            </button>
          </div>
      )}
    </div>
  );
}
