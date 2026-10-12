import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { format, isValid, parse } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'; // [MOBILE ONLY]
import { useIsMobile } from '@/hooks/useIsMobile'; // [MOBILE ONLY]
import { cn } from '@/lib/utils';

const DATE_FORMAT = 'yyyy-MM-dd';

function parseDateValue(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = parse(value, DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

interface DatePickerProps {
  value?: string | null;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  portalContainer?: HTMLElement | null;
  testId?: string;
  onChange: (value: string | null) => void | Promise<void>;
}

export function DatePicker({
  value,
  placeholder,
  ariaLabel,
  disabled,
  portalContainer,
  testId,
  onChange,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | undefined>(() => parseDateValue(value));
  const [month, setMonth] = useState<Date>(() => parseDateValue(value) || new Date());
  useEffect(() => {
    if (!open) {
      const nextDate = parseDateValue(value);
      setDraftDate(nextDate);
      setMonth(nextDate || new Date());
    }
  }, [open, value]);

  const buttonLabel = value || placeholder;

  const handleConfirm = async (nextDate: Date | undefined) => {
    setOpen(false);
    await onChange(nextDate ? format(nextDate, DATE_FORMAT, { locale: zhCN }) : null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          className={cn(
            'h-[var(--tf-density-button-height)] w-full justify-between rounded-[var(--tf-density-control-radius)] border-border bg-card px-[var(--tf-density-control-padding-x)] text-sm font-normal text-foreground transition-all duration-200 hover:bg-background',
            !value && 'text-muted-foreground'
          )}
          aria-label={ariaLabel}
          data-testid={testId}
        >
          <span>{buttonLabel}</span>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent portalContainer={portalContainer} className="w-auto p-3">
        <div className="flex w-63 flex-col gap-3">
          <Calendar
            mode="single"
            selected={draftDate}
            month={month}
            onMonthChange={setMonth}
            onSelect={(nextDate) => {
              setDraftDate(nextDate || undefined);
              if (nextDate) {
                setMonth(nextDate);
              }
            }}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setDraftDate(undefined);
                void handleConfirm(undefined);
              }}
            >
              清除
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                void handleConfirm(draftDate);
              }}
            >
              确定
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DateRangePickerProps {
  startDate?: string | null;
  endDate?: string | null;
  disabled?: boolean;
  portalContainer?: HTMLElement | null;
  testId?: string;
  displayMode?: 'popover' | 'dialog';
  onChange: (range: { startDate: string | null; endDate: string | null }) => void | Promise<void>;
}

/**
 * [MOBILE ADAPTATION] 增强版日期范围选择器
 * 桌面端默认使用 Popover，当指定 displayMode="dialog" 时使用屏幕居中 Dialog，移动端使用 ResponsiveDialog (底部抽屉)。
 */
export function DateRangePicker({
  startDate,
  endDate,
  disabled,
  portalContainer,
  testId,
  displayMode = 'popover',
  onChange,
}: DateRangePickerProps) {
  const isMobile = useIsMobile(); // [MOBILE ONLY]
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() => ({
    from: parseDateValue(startDate),
    to: parseDateValue(endDate),
  }));

  useEffect(() => {
    if (!open) {
      setDraft({
        from: parseDateValue(startDate),
        to: parseDateValue(endDate),
      });
    }
  }, [open, startDate, endDate]);

  const hasValue = Boolean(startDate || endDate);

  const handleConfirm = async () => {
    setOpen(false);
    await onChange({
      startDate: draft?.from ? format(draft.from, DATE_FORMAT) : null,
      endDate: draft?.to ? format(draft.to, DATE_FORMAT) : null,
    });
  };

  const handleClear = async () => {
    setDraft({ from: undefined, to: undefined });
    setOpen(false);
    await onChange({ startDate: null, endDate: null });
  };

  const trigger = (
    <Button
      variant="outline"
      className={cn(
        'h-[var(--tf-density-button-height)] w-full justify-start gap-2 px-[var(--tf-density-control-padding-x)] font-normal',
        isMobile ? "bg-[#F9FAFB] border-none shadow-none" : "", // [MOBILE ADAPTATION] 遵循 Notion 风格
        hasValue ? 'text-foreground' : 'text-muted-foreground'
      )}
      aria-label="选择时间范围"
      data-testid={testId}
    >
      <CalendarDays className="h-4 w-4 shrink-0" />
      {draft?.from ? (
        draft.to ? (
          <span>{format(draft.from, 'MM/dd', { locale: zhCN })} — {format(draft.to, 'MM/dd', { locale: zhCN })}</span>
        ) : (
          <span>{format(draft.from, 'MM/dd', { locale: zhCN })} — 未设置</span>
        )
      ) : (
        <span>选择时间范围</span>
      )}
    </Button>
  );

  const content = (
    <div className={cn(
      "flex flex-col gap-4 overflow-y-auto max-h-[75dvh]",
      isMobile ? "p-5" : displayMode === 'dialog' ? "p-1" : "p-3"
    )}>
      <div className="flex justify-center overflow-hidden shrink-0">
        <Calendar
          mode="range"
          selected={draft}
          defaultMonth={draft?.from ?? new Date()}
          onSelect={setDraft}
          numberOfMonths={isMobile ? 1 : 2} // [MOBILE ONLY] 移动端仅显示 1 个月
          className="mx-auto"
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4 mt-auto shrink-0">
        <Button variant="outline" className="flex-1 rounded-md" onClick={() => void handleClear()}>
          清除
        </Button>
        <Button className="flex-1 rounded-md" onClick={() => void handleConfirm()}>
          确定
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="选择时间范围"
        trigger={trigger}
        contentClassName="p-0" // 覆盖默认的 padding
      >
        {content}
      </ResponsiveDialog>
    );
  }

  if (displayMode === 'dialog') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild disabled={disabled}>
          {trigger}
        </DialogTrigger>
        <DialogContent
          className="w-auto max-w-[95vw] sm:max-w-[580px] p-5 gap-3 rounded-2xl shadow-xl z-1600"
        >
          <DialogHeader className="px-1 text-left">
            <DialogTitle className="text-sm font-semibold text-foreground">
              选择时间范围
            </DialogTitle>
            <DialogDescription className="sr-only">
              选择任务的开始日期与截止日期
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent portalContainer={portalContainer} className="w-auto p-0" align="start">
        {content}
      </PopoverContent>
    </Popover>
  );
}
