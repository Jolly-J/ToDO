/**
 * 附件选择触发器组件
 * 封装隐藏的 file input，通过按钮触发文件选择，支持多选和加载状态
 */
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AttachmentPickerTriggerProps {
  testId: string;
  buttonText: string;
  icon?: ReactNode;
  multiple?: boolean;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  onSelect: (files: File[]) => void;
}

export default function AttachmentPickerTrigger({
  testId,
  buttonText,
  icon,
  multiple = true,
  loading = false,
  disabled = false,
  className,
  onSelect,
}: AttachmentPickerTriggerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleOpen = () => {
    if (disabled || loading) {
      return;
    }

    inputRef.current?.click();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) {
      return;
    }

    onSelect(files);
  };

  return (
    <span className={className}>
      <input
        ref={inputRef}
        data-testid={testId}
        type="file"
        multiple={multiple}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <Button type="button" variant="outline" disabled={disabled || loading} onClick={handleOpen}>
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
        {buttonText}
      </Button>
    </span>
  );
}
