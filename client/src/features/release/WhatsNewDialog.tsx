import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReleaseDialogSurface from './ReleaseDialogSurface';
import type { ReleasePage } from './types';

interface WhatsNewDialogProps {
  open: boolean;
  title: string;
  version: string;
  releasedAt: string;
  pages: ReleasePage[];
  onClose: () => void;
}

export default function WhatsNewDialog({
  open,
  title,
  version,
  releasedAt,
  pages,
  onClose,
}: WhatsNewDialogProps) {
  const [activePageIndex, setActivePageIndex] = useState(0);
  const activePage = pages[activePageIndex];
  const hasPrevious = activePageIndex > 0;
  const hasNext = activePageIndex < pages.length - 1;

  if (!activePage) {
    return null;
  }

  const closeDialog = () => {
    setActivePageIndex(0);
    onClose();
  };

  const footer = (
    <div data-testid="whats-new-footer" className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="justify-self-start rounded-full"
        aria-label="上一页"
        disabled={!hasPrevious}
        onClick={() => setActivePageIndex((pageIndex) => Math.max(0, pageIndex - 1))}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <div className="flex items-center justify-center gap-2">
        {pages.map((page, index) => (
          <button
            key={page.title}
            type="button"
            className={cn(
              'h-2 rounded-full transition-all',
              index === activePageIndex ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40'
            )}
            aria-label={`第 ${index + 1} 页`}
            aria-current={index === activePageIndex ? 'step' : undefined}
            onClick={() => setActivePageIndex(index)}
          />
        ))}
      </div>
      <Button
        type="button"
        variant={hasNext ? 'outline' : 'default'}
        size={hasNext ? 'icon' : 'sm'}
        className="justify-self-end rounded-full"
        aria-label={hasNext ? '下一页' : '我知道了'}
        onClick={() => {
          if (hasNext) {
            setActivePageIndex((pageIndex) => Math.min(pages.length - 1, pageIndex + 1));
            return;
          }
          closeDialog();
        }}
      >
        {hasNext ? <ChevronRight aria-hidden="true" /> : '我知道了'}
      </Button>
    </div>
  );

  return (
    <ReleaseDialogSurface
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) closeDialog(); }}
      title={title}
      description={`版本 ${version} · ${releasedAt}`}
      closeLabel="关闭更新说明"
      footer={footer}
      mobileContentClassName="h-[85vh] supports-[height:100dvh]:h-[85dvh]"
    >
      <img
        src={activePage.image}
        alt={activePage.title}
        className="aspect-video w-full rounded-lg bg-muted object-cover"
      />

      <div data-testid="whats-new-page-copy" className="pt-5 text-left">
        <h3 className="text-xl font-semibold leading-7 text-foreground">{activePage.title}</h3>
        <p className="mt-2.5 max-w-[32rem] text-sm leading-6 text-muted-foreground">
          {activePage.description}
          {activePage.link ? (
            <>
              {' '}
              <a
                href={activePage.link.href}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline-offset-4 transition hover:underline"
              >
                {activePage.link.label}
              </a>
            </>
          ) : null}
        </p>
      </div>
    </ReleaseDialogSurface>
  );
}
