/**
 * 任务列表导出工具
 * 将任务数据按照当前筛选视图导出为包含精美排版样式（深蓝表头、微软雅黑、细边框、居中与换行、定制列宽）的 Excel (.xlsx) 文件。
 */
import XLSX from 'xlsx-js-style';
import { getPriorityLabel, getStatusLabel } from '@/config/taskSemanticColors';
import type { Task } from '@/types';
import { buildTaskTree } from '@/utils/task/buildTaskTree';
import { toast } from 'sonner';

/** Excel 9 列定制列宽（字符宽度） */
export const TASK_EXCEL_COL_WIDTHS = [
  { wch: 68 }, // 1. 任务标题 (加宽以清晰换行展示)
  { wch: 27 }, // 2. 父级任务
  { wch: 43 }, // 3. 任务描述
  { wch: 15 }, // 4. 负责人
  { wch: 23 }, // 5. 参与人
  { wch: 13 }, // 6. 优先级
  { wch: 15 }, // 7. 状态
  { wch: 16 }, // 8. 开始日期
  { wch: 16 }, // 9. 截止日期
];

/** 全单元格细实线边框 */
export const THIN_BORDER = {
  top: { style: 'thin', color: { auto: 1 } },
  bottom: { style: 'thin', color: { auto: 1 } },
  left: { style: 'thin', color: { auto: 1 } },
  right: { style: 'thin', color: { auto: 1 } },
};

/** 表头样式：商务深蓝底色、纯白加粗、12pt 微软雅黑、居中对齐、细边框 */
export const HEADER_STYLE = {
  font: {
    name: 'Microsoft YaHei',
    sz: 12,
    bold: true,
    color: { rgb: 'FFFFFF' },
  },
  fill: {
    patternType: 'solid',
    fgColor: { rgb: '0070C0' },
  },
  alignment: {
    horizontal: 'center',
    vertical: 'center',
    wrapText: true,
  },
  border: THIN_BORDER,
};

/** 数据行样式：左对齐 + 垂直居中 + 自动换行（任务标题、任务描述） */
export const DATA_LEFT_WRAP_STYLE = {
  font: {
    name: 'Microsoft YaHei',
    sz: 12,
    color: { theme: 1 },
  },
  alignment: {
    horizontal: 'left',
    vertical: 'center',
    wrapText: true,
  },
  border: THIN_BORDER,
};

/** 数据行样式：左对齐 + 垂直居中（父级任务） */
export const DATA_LEFT_STYLE = {
  font: {
    name: 'Microsoft YaHei',
    sz: 12,
    color: { theme: 1 },
  },
  alignment: {
    horizontal: 'left',
    vertical: 'center',
  },
  border: THIN_BORDER,
};

/** 数据行样式：水平居中 + 垂直居中（负责人、参与人、优先级、状态、日期） */
export const DATA_CENTER_STYLE = {
  font: {
    name: 'Microsoft YaHei',
    sz: 12,
    color: { theme: 1 },
  },
  alignment: {
    horizontal: 'center',
    vertical: 'center',
  },
  border: THIN_BORDER,
};

/** 树状任务拍平，保证主任务后紧跟其子任务 */
export function flattenTaskTree(tree: Task[]): Task[] {
  const result: Task[] = [];
  function traverse(nodes: Task[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.subtasks && node.subtasks.length > 0) {
        traverse(node.subtasks);
      }
    }
  }
  traverse(tree);
  return result;
}

/** 生成当前筛选任务列表的二维数组数据 */
export function generateTasksExportData(tasks: Task[]): string[][] {
  const headers = [
    '任务标题',
    '父级任务',
    '任务描述',
    '负责人',
    '参与人',
    '优先级',
    '状态',
    '开始日期',
    '截止日期',
  ];

  // 建立任务 ID -> Task 的映射，方便查找父任务标题
  const taskMap = new Map<string, Task>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  // 先按树结构组织再打平，确保导出顺序与界面树状顺序一致
  const tree = buildTaskTree(tasks);
  const flatOrderedTasks = flattenTaskTree(tree);

  const rows: string[][] = [headers];

  for (const task of flatOrderedTasks) {
    // 1. 任务标题
    const title = task.title || '';

    // 2. 父级任务 (若有父级任务，显示父级任务标题；主任务留空)
    let parentTitle = '';
    if (task.parent_id) {
      const parentTask = taskMap.get(task.parent_id);
      if (parentTask) {
        parentTitle = parentTask.title;
      } else if (task.breadcrumbs && task.breadcrumbs.length > 1) {
        // 如果父任务被筛选条件过滤，可尝试从 breadcrumbs 中取上一级标题
        parentTitle = task.breadcrumbs[task.breadcrumbs.length - 2]?.title || '';
      }
    }

    // 3. 任务描述
    const description = task.description || '';

    // 4. 负责人
    const assignee = task.assignee_name || (task.assignee_id ? '未命名成员' : '-');

    // 5. 参与人 (多人顿号分隔)
    const participants =
      Array.isArray(task.participants) && task.participants.length > 0
        ? task.participants.map((p) => p.name).filter(Boolean).join('、')
        : '-';

    // 6. 优先级
    const priority = getPriorityLabel(task.priority);

    // 7. 状态
    const status = getStatusLabel(task.status);

    // 8. 开始日期
    const startDate = task.start_date || '-';

    // 9. 截止日期
    const dueDate = task.due_date || '-';

    rows.push([
      title,
      parentTitle,
      description,
      assignee,
      participants,
      priority,
      status,
      startDate,
      dueDate,
    ]);
  }

  return rows;
}

/** 构建包含完整样式、边框与列宽的 Excel 工作簿对象 */
export function buildTasksWorkbook(tasks: Task[]): XLSX.WorkBook {
  const data = generateTasksExportData(tasks);
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // 设定列宽
  worksheet['!cols'] = TASK_EXCEL_COL_WIDTHS;

  // 遍历单元格赋予样式
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:I1');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: 's', v: '' };
      }
      const cell = worksheet[cellAddress];

      if (R === 0) {
        // 表头：深蓝底白字加粗居中
        cell.s = HEADER_STYLE;
      } else {
        // 数据行
        if (C === 0 || C === 2) {
          // 任务标题 (0)、任务描述 (2)：左对齐 + 垂直居中 + 自动换行
          cell.s = DATA_LEFT_WRAP_STYLE;
        } else if (C === 1) {
          // 父级任务 (1)：左对齐 + 垂直居中
          cell.s = DATA_LEFT_STYLE;
        } else {
          // 其他列 (负责人、参与人、优先级、状态、日期)：水平居中 + 垂直居中
          cell.s = DATA_CENTER_STYLE;
        }
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '任务列表');
  return workbook;
}

/** 导出任务为具有定制样式的 Excel (.xlsx) 文件 */
export function exportTasksToExcel(tasks: Task[], filename: string) {
  if (!tasks || tasks.length === 0) {
    toast.info('当前筛选条件下暂无任务可导出');
    return;
  }

  try {
    const workbook = buildTasksWorkbook(tasks);
    const realFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(workbook, realFilename);
    toast.success(`已成功导出 ${tasks.length} 条任务数据`);
  } catch (error) {
    console.error('导出任务列表失败:', error);
    toast.error('导出任务列表失败，请重试');
  }
}
