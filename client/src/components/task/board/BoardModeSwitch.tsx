/**
 * 组件名称：视图模式切换器
 * 文件作用：在任务工作区中切换看板、列表和日历三种视图。
 * 主要功能：展示模式按钮，并与任务视图状态保持联动。
 */
import { LayoutGrid, LayoutList, Calendar } from 'lucide-react';
import type { BoardMode } from '@/types/multi-board';
import { useTaskStore } from '@/store';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import styles from './BoardModeSwitch.module.css';

interface BoardModeSwitchProps {
  className?: string;
  style?: React.CSSProperties;
  value?: BoardMode;
  onChange?: (mode: BoardMode) => void;
}

const modeOptions = [
  { label: '看板', value: 'board' as BoardMode, icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { label: '列表', value: 'list' as BoardMode, icon: <LayoutList className="h-3.5 w-3.5" /> },
  { label: '日历', value: 'calendar' as BoardMode, icon: <Calendar className="h-3.5 w-3.5" /> },
];

export default function BoardModeSwitch({ className, style, value, onChange }: BoardModeSwitchProps) {
  const currentView = useTaskStore((state) => state.currentView) as BoardMode;
  const setView = useTaskStore((state) => state.setView);
  const activeView = value ?? currentView;

  const handleModeChange = (newMode: string) => {
    const startTime = performance.now();
    if (onChange) {
      onChange(newMode as BoardMode);
    } else {
      setView(newMode as BoardMode);
    }
    requestAnimationFrame(() => {
      const switchTime = performance.now() - startTime;
      if (switchTime > 500) {
        console.warn(`视图切换耗时 ${switchTime.toFixed(2)}ms，超过 500ms 限制`);
      }
    });
  };

  return (
    <div
      className={`${styles.boardModeSwitch} ${className || ''}`}
      style={style}
      role="toolbar"
      aria-label="看板模式切换"
    >
      <Tabs value={activeView} onValueChange={handleModeChange}>
        <TabsList className="h-8">
          {modeOptions.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value} className="gap-1.5 px-2.5 text-xs">
              {opt.icon}
              {opt.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
