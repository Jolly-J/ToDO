import { useEffect, useState } from 'react';
import { Download, LoaderCircle, X } from 'lucide-react';
import type { Attachment } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { downloadAttachment, fetchAttachmentBlob, type AttachmentSource } from '@/utils/downloadAttachment';
import { getFileTypePresentation } from './FileTypeIcon';

type PreviewAttachment = Pick<Attachment, 'id' | 'original_name' | 'mime_type'>;
export interface DirectImagePreview {
  src: string;
  name?: string;
  alt?: string;
}

interface AttachmentImagePreviewDialogProps {
  attachment: PreviewAttachment | null;
  source?: AttachmentSource;
  directImage?: DirectImagePreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function isImageAttachment(attachment?: Pick<Attachment, 'original_name' | 'mime_type'> | null) {
  if (!attachment) return false;
  return getFileTypePresentation({
    fileName: attachment.original_name,
    mimeType: attachment.mime_type,
  }).kind === 'image';
}

export default function AttachmentImagePreviewDialog({
  attachment,
  source,
  directImage,
  open,
  onOpenChange,
}: AttachmentImagePreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || (!attachment && !directImage)) {
      setPreviewUrl(null);
      setLoading(false);
      setError(false);
      return;
    }

    if (directImage) {
      setPreviewUrl(directImage.src);
      setLoading(false);
      setError(false);
      return;
    }

    if (!attachment || !source) return;

    let disposed = false;
    let objectUrl: string | null = null;

    setPreviewUrl(null);
    setLoading(true);
    setError(false);

    fetchAttachmentBlob(attachment.id, source)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (disposed) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!disposed) {
          setError(true);
        }
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment, directImage, open, source]);

  const filename = attachment?.original_name || directImage?.name || directImage?.alt || '图片预览';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,960px)] max-h-[90vh] gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[#111] p-0 text-white">
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-left">
          <div className="min-w-0">
            <DialogTitle className="truncate text-[14px] font-medium text-white">{filename}</DialogTitle>
            <DialogDescription className="sr-only">图片附件预览</DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {attachment && source ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="下载图片附件"
                className="text-white/75 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  void downloadAttachment(attachment.id, attachment.original_name, source);
                }}
              >
                <Download className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="关闭图片预览"
                className="text-white/75 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="flex min-h-[320px] max-h-[calc(90vh-57px)] items-center justify-center bg-[#0b0b0b] p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-white/70">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              正在加载图片
            </div>
          ) : error ? (
            <div className="text-[13px] text-white/70">图片加载失败，请下载后查看</div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={directImage?.alt || filename}
              className={cn('max-h-[calc(90vh-96px)] max-w-full rounded-lg object-contain')}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
