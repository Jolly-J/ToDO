import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

interface ReleaseDialogSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  headerLeading?: ReactNode;
  closeLabel: string;
  bodyClassName?: string;
  desktopContentClassName?: string;
  mobileContentClassName?: string;
}

export default function ReleaseDialogSurface({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  headerLeading,
  closeLabel,
  bodyClassName,
  desktopContentClassName,
  mobileContentClassName,
}: ReleaseDialogSurfaceProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          data-testid="release-mobile-sheet"
          className={cn(
            'h-auto max-h-[85vh] rounded-t-2xl border-x-0 border-b-0 supports-[height:100dvh]:max-h-[85dvh]',
            mobileContentClassName
          )}
        >
          <SheetHeader className="shrink-0 flex-row items-start justify-between gap-4 px-5 py-4 text-left">
            <div className="flex min-w-0 items-start gap-3">
              {headerLeading}
              <div className="min-w-0">
                <SheetTitle className="text-lg">{title}</SheetTitle>
                <SheetDescription className="mt-1.5 leading-5">{description}</SheetDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={closeLabel}
              title={closeLabel}
              onClick={() => onOpenChange(false)}
            >
              <X aria-hidden="true" />
            </Button>
          </SheetHeader>

          {children ? (
            <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>
              {children}
            </div>
          ) : null}

          {footer ? (
            <div className="shrink-0 border-t border-border px-4 pt-3">
              <div className="pb-safe">
                <div className="pb-3">{footer}</div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="release-desktop-dialog"
        className={cn(
          'max-h-[88dvh] w-[min(92vw,540px)] gap-0 overflow-hidden p-0',
          desktopContentClassName
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex min-w-0 items-start gap-3">
            {headerLeading}
            <div className="min-w-0">
              <DialogTitle className="text-xl">{title}</DialogTitle>
              <DialogDescription className="mt-2 leading-5">{description}</DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={() => onOpenChange(false)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        {children ? (
          <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', bodyClassName)}>
            {children}
          </div>
        ) : null}

        {footer ? (
          <div className="shrink-0 border-t border-border px-6 py-4">{footer}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
