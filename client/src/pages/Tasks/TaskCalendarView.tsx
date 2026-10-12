/**
 * 组件名称：任务日历视图
 * 文件作用：按日期展示团队任务安排。
 * 主要功能：以月历形式查看任务截止日期，使用 antd Calendar 通知事项样式渲染任务条，点击任务打开详情。
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Button, ConfigProvider, Drawer, Empty, Radio, Select, Tag } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import type { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import type { TaskPriority, TaskStatus } from '@/types';

import { useTaskStore } from '@/store';
import {
  taskToolbarHintStyle,
  taskToolbarLeadingStyle,
  taskToolbarMiddleStyle,
  taskToolbarRowStyle,
  taskToolbarTrailingStyle,
} from './toolbarStyles';
import styles from './TaskCalendarView.module.css';
import {
  buildTasksByDate,
  CALENDAR_PRIORITY_FILTER_OPTIONS,
  CALENDAR_STATUS_FILTER_OPTIONS,
  filterCalendarTasks,
  getCalendarTaskStatusColor,
} from './taskCalendarViewModel';

interface TaskCalendarViewProps {
  teamId?: string;
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  onTaskClick?: (taskId: string) => void;
}

type CalendarMode = 'month' | 'year';

export default function TaskCalendarView({ teamId: teamIdProp, toolbarStart, toolbarEnd, onTaskClick }: TaskCalendarViewProps) {
  const [searchParams] = useSearchParams();
  const teamId = teamIdProp || searchParams.get('teamId') || '';
  const { calendarData, fetchTasks } = useTaskStore();
  const [calendarValue, setCalendarValue] = useState(dayjs().locale('zh-cn'));
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [selectedDateTasks, setSelectedDateTasks] = useState<typeof calendarData>([]);
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false);

  useEffect(() => {
    if (teamId) fetchTasks(teamId);
  }, [teamId, fetchTasks]);

  const filteredCalendarData = useMemo(
    () => filterCalendarTasks(calendarData, { status: statusFilter, priority: priorityFilter }),
    [calendarData, statusFilter, priorityFilter]
  );

  // 按日期分组任务
  const tasksByDate = useMemo(() => {
    return buildTasksByDate(filteredCalendarData);
  }, [filteredCalendarData]);

  const handleSelectDate = (date: Dayjs) => {
    const key = date.format('YYYY-MM-DD');
    const tasks = tasksByDate.get(key) || [];
    setSelectedDate(date);
    setSelectedDateTasks(tasks);
    setDateDrawerOpen(true);
  };

  const localizedCalendarValue = calendarValue.locale('zh-cn');

  const calendarHeaderRender = ({
    value,
    type,
    onChange,
    onTypeChange,
  }: {
    value: Dayjs;
    type: CalendarMode;
    onChange: (nextValue: Dayjs) => void;
    onTypeChange: (nextType: CalendarMode) => void;
  }) => {
    const baseValue = value.locale('zh-cn');
    const currentYear = baseValue.year();
    const yearOptions = Array.from({ length: 21 }, (_, index) => {
      const year = currentYear - 10 + index;
      return {
        label: `${year}年`,
        value: year,
      };
    });
    const monthOptions = Array.from({ length: 12 }, (_, index) => ({
      label: `${index + 1}月`,
      value: index,
    }));

    return (
      <div className={styles.calendarHeader}>
        <div className={styles.calendarHeaderSelectors}>
          <Select
            value={baseValue.year()}
            options={yearOptions}
            className={styles.headerSelect}
            aria-label="年份选择"
            onChange={(nextYear: number) => {
              onChange(baseValue.clone().year(nextYear).locale('zh-cn'));
            }}
          />
          <Select
            value={baseValue.month()}
            options={monthOptions}
            className={styles.headerSelect}
            aria-label="月份选择"
            onChange={(nextMonth: number) => {
              onChange(baseValue.clone().month(nextMonth).locale('zh-cn'));
            }}
          />
        </div>
        <Radio.Group
          value={type}
          buttonStyle="solid"
          onChange={(event) => onTypeChange(event.target.value as CalendarMode)}
        >
          <Radio.Button value="month">月视图</Radio.Button>
          <Radio.Button value="year">年视图</Radio.Button>
        </Radio.Group>
      </div>
    );
  };

  const cellRender = (date: Dayjs) => {
    const key = date.format('YYYY-MM-DD');
    const tasks = tasksByDate.get(key);
    if (!tasks?.length) return null;

    const today = dayjs().format('YYYY-MM-DD');

    return (
      <div className={styles.cellContent}>
        <div className={styles.cellSummary}>{tasks.length} 项任务</div>
        <ul className={styles.taskList}>
          {tasks.slice(0, 2).map(task => {
            // 判断是否逾期：未完成且截止日期早于今天
            const isOverdue = task.status !== 'done' && task.status !== 'delayed_done' && task.status !== 'canceled' && task.date < today;
            const statusColor = getCalendarTaskStatusColor({ status: task.status, isOverdue });

            return (
              <li key={task.id}>
                <button
                  type="button"
                  className={styles.cellTaskButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskClick?.(task.id);
                  }}
                >
                  <span
                    className={styles.cellTaskPriorityBar}
                    style={{ backgroundColor: statusColor }}
                    aria-hidden="true"
                  />
                  <span className={styles.taskTitle} title={task.title}>
                    {task.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {tasks.length > 2 ? <div className={styles.moreHint}>另有 {tasks.length - 2} 项</div> : null}
      </div>
    );
  };

  return (
    <div>
      <div style={taskToolbarRowStyle}>
        <div style={taskToolbarLeadingStyle} data-testid="task-toolbar-leading">{toolbarStart}</div>
        <div style={taskToolbarMiddleStyle} data-testid="task-toolbar-middle">
          <div style={taskToolbarHintStyle}>按截止日期查看任务，适合安排周期计划</div>
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            options={CALENDAR_STATUS_FILTER_OPTIONS}
            className={styles.filterSelect}
            aria-label="状态筛选"
          />
          <Select
            value={priorityFilter}
            onChange={(value) => setPriorityFilter(value)}
            options={CALENDAR_PRIORITY_FILTER_OPTIONS}
            className={styles.filterSelect}
            aria-label="优先级筛选"
          />
          <Button onClick={() => setCalendarValue(dayjs().locale('zh-cn'))}>回到今天</Button>
        </div>
        <div style={taskToolbarTrailingStyle} data-testid="task-toolbar-trailing">{toolbarEnd}</div>
      </div>

      <div className={styles.calendarWrapper}>
        <ConfigProvider locale={zhCN}>
          <Calendar
            value={localizedCalendarValue}
            onChange={(next) => setCalendarValue(next.locale('zh-cn'))}
            onSelect={handleSelectDate}
            cellRender={cellRender}
            headerRender={calendarHeaderRender}
          />
        </ConfigProvider>
      </div>

      <Drawer
        title={selectedDate ? `${selectedDate.format('YYYY年MM月DD日')} 任务` : '当日任务'}
        open={dateDrawerOpen}
        onClose={() => setDateDrawerOpen(false)}
        width={420}
      >
        {selectedDateTasks.length === 0 ? (
          <Empty description="当日暂无任务" />
        ) : (
          <ul className={styles.drawerTaskList}>
            {selectedDateTasks.map((task) => (
              <li key={task.id} className={styles.drawerTaskItem}>
                <button
                  type="button"
                  className={styles.drawerTaskButton}
                  onClick={() => {
                    onTaskClick?.(task.id);
                    setDateDrawerOpen(false);
                  }}
                >
                  <span className={styles.drawerTaskTitle}>{task.title}</span>
                  <span className={styles.drawerTaskMeta}>
                    <Tag>{CALENDAR_PRIORITY_FILTER_OPTIONS.find((option) => option.value === task.priority)?.label || '中'}</Tag>
                    <Tag>{CALENDAR_STATUS_FILTER_OPTIONS.find((option) => option.value === task.status)?.label || '进行中'}</Tag>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </div>
  );
}
