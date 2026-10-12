/**
 * shared.tsx - Admin 共享组件和工具函数
 *
 * 提供了 Admin 模块内部复用的 UI 组件（如状态标签、信息列表、空状态面板等）
 * 和工具函数（如时间格式化、状态映射等），确保整个 Admin 系统的视觉和交互一致性。
 *
 * @module pages/Admin
 */

import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { StatusTone } from './types';
import styles from './Admin.module.css';

const toneClassMap: Record<StatusTone, string> = {
  success: styles.statusSuccess,
  warning: styles.statusWarning,
  error: styles.statusError,
  neutral: styles.statusNeutral,
};

export function formatDateTime(value?: string | null) {
  if (!value) {
    return '暂无记录';
  }

  const d = dayjs(value).tz('Asia/Shanghai');
  if (!d.isValid()) {
    return '时间未知';
  }

  return d.format('MM-DD HH:mm');
}

export function getToneLabel(tone: StatusTone) {
  if (tone === 'success') {
    return '稳定';
  }
  if (tone === 'warning') {
    return '关注';
  }
  if (tone === 'error') {
    return '异常';
  }
  return '待采样';
}

export function StatusInline({
  tone,
  label,
  className,
}: {
  tone: StatusTone;
  label: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn('gap-1.5 whitespace-nowrap font-normal', className)}>
      <span className={cn(styles.statusDot, toneClassMap[tone])} />
      <span>{label}</span>
    </Badge>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-[#F1F1EF] pb-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-[#37352F]">{title}</h1>
        <p className="mt-0.5 max-w-4xl truncate text-xs text-[#9B9A97]">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function AdminPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between border-t border-border bg-background px-4 py-2.5">
      <span className="text-xs text-muted-foreground">
        显示 {start}–{end} 条，共 {total} 条
      </span>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text="上一页"
              aria-disabled={page <= 1}
              className={cn(page <= 1 && 'pointer-events-none opacity-50')}
              onClick={(event) => {
                event.preventDefault();
                if (page > 1) onPageChange(page - 1);
              }}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive onClick={(event) => event.preventDefault()} className="cursor-default tabular-nums">
              {page}/{totalPages}
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              text="下一页"
              aria-disabled={page >= totalPages}
              className={cn(page >= totalPages && 'pointer-events-none opacity-50')}
              onClick={(event) => {
                event.preventDefault();
                if (page < totalPages) onPageChange(page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

export function AdminFilterSelect({
  value,
  onValueChange,
  ariaLabel,
  options,
  triggerClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  options: Array<{ value: string; label: string }>;
  triggerClassName?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={ariaLabel} className={cn('w-full', triggerClassName)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function InfoList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-3">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1 border-b border-(--tf-border-soft) pb-3 last:border-b-0 last:pb-0">
          <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{item.label}</dt>
          <dd className="text-sm leading-6 text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border bg-accent/30 px-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function AdminTruncatedText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('block truncate', className)}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-96">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
