/**
 * 组件名称：中文日期选择器
 * 文件作用：为任务系统提供统一的中文日期选择弹层。
 * 主要功能：封装项目 DatePicker，保持与原 ZhDatePicker 相同的对外接口。
 */
import { DatePicker } from '@/components/ui/date-picker';

interface ZhDatePickerProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ZhDatePicker({ value, onChange, placeholder = '请选择日期', disabled }: ZhDatePickerProps) {
  return (
    <DatePicker
      value={value}
      placeholder={placeholder}
      ariaLabel={placeholder}
      disabled={disabled}
      onChange={(v) => onChange?.(v)}
    />
  );
}
