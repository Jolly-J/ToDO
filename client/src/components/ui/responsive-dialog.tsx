import * as React from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface ResponsiveDialogProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  trigger?: React.ReactNode
  className?: string
  contentClassName?: string
}

/**
 * [MOBILE ADAPTATION] 自适应对话框组件
 * 桌面端显示为中央 Dialog，移动端自动切换为底部 Sheet (Drawer)。
 */
export function ResponsiveDialog({
  children,
  open,
  onOpenChange,
  title,
  description,
  trigger,
  className,
  contentClassName,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
        <SheetContent 
          side="bottom" 
          className={cn("px-0 pb-safe rounded-t-xl max-h-[85dvh] flex flex-col", contentClassName)} // [MOBILE ADAPTATION] 使用 max-h-[85dvh] 限制最大高度
        >
          <SheetHeader className="px-6 pt-6 pb-2 text-left shrink-0">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto min-h-0 w-full">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn("sm:max-w-[500px] p-0 overflow-hidden", contentClassName)}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className={className}>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
