/**
 * 文件类型图标组件
 * 根据文件扩展名自动匹配对应的 Lucide 图标（Excel/Word/PDF/图片/视频等）
 */
import type { ComponentType } from 'react';
import {
  Archive,
  FileCode2,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  Image,
  Presentation,
  Type,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type FileKind = 'excel' | 'word' | 'ppt' | 'pdf' | 'image' | 'video' | 'zip' | 'markdown' | 'text' | 'unknown';

type FileTypePresentation = {
  kind: FileKind;
  label: string;
  ariaLabel: string;
  color: string;
  backgroundColor: string;
  Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
};

const FILE_TYPE_PRESENTATIONS: Record<FileKind, FileTypePresentation> = {
  excel: {
    kind: 'excel',
    label: 'Excel',
    ariaLabel: 'excel 文件',
    color: '#1f7a46',
    backgroundColor: '#edf8f1',
    Icon: FileSpreadsheet,
  },
  word: {
    kind: 'word',
    label: 'Word',
    ariaLabel: 'word 文件',
    color: '#185abd',
    backgroundColor: '#edf3ff',
    Icon: FileText,
  },
  ppt: {
    kind: 'ppt',
    label: 'PPT',
    ariaLabel: 'ppt 文件',
    color: '#c74634',
    backgroundColor: '#fff1ed',
    Icon: Presentation,
  },
  pdf: {
    kind: 'pdf',
    label: 'PDF',
    ariaLabel: 'pdf 文件',
    color: '#b42318',
    backgroundColor: '#fff2ef',
    Icon: FileText,
  },
  image: {
    kind: 'image',
    label: '图片',
    ariaLabel: '图片 文件',
    color: '#7a4ee0',
    backgroundColor: '#f4efff',
    Icon: Image,
  },
  video: {
    kind: 'video',
    label: '视频',
    ariaLabel: '视频 文件',
    color: '#9a4d00',
    backgroundColor: '#fff4e8',
    Icon: Video,
  },
  zip: {
    kind: 'zip',
    label: '压缩包',
    ariaLabel: '压缩包 文件',
    color: '#8a5a00',
    backgroundColor: '#fff7e5',
    Icon: Archive,
  },
  markdown: {
    kind: 'markdown',
    label: 'Markdown',
    ariaLabel: 'markdown 文件',
    color: '#4f5d75',
    backgroundColor: '#eef1f5',
    Icon: FileCode2,
  },
  text: {
    kind: 'text',
    label: '文本',
    ariaLabel: '文本 文件',
    color: '#4f5d75',
    backgroundColor: '#f2f4f7',
    Icon: Type,
  },
  unknown: {
    kind: 'unknown',
    label: '文件',
    ariaLabel: '文件',
    color: '#667085',
    backgroundColor: '#f2f4f7',
    Icon: FileQuestion,
  },
};

const EXTENSION_KIND_MAP: Record<string, FileKind> = {
  xls: 'excel',
  xlsx: 'excel',
  csv: 'excel',
  numbers: 'excel',
  doc: 'word',
  docx: 'word',
  rtf: 'word',
  ppt: 'ppt',
  pptx: 'ppt',
  key: 'ppt',
  pdf: 'pdf',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  mov: 'video',
  mp4: 'video',
  m4v: 'video',
  avi: 'video',
  webm: 'video',
  zip: 'zip',
  rar: 'zip',
  '7z': 'zip',
  tar: 'zip',
  gz: 'zip',
  tgz: 'zip',
  md: 'markdown',
  markdown: 'markdown',
  txt: 'text',
  log: 'text',
  json: 'text',
  yml: 'text',
  yaml: 'text',
  xml: 'text',
};

function getExtension(fileName?: string) {
  if (!fileName) return '';
  const cleanName = String(fileName).trim().toLowerCase();
  const extension = cleanName.split('.').pop();
  return extension && extension !== cleanName ? extension : '';
}

function resolveFileKind(fileName?: string, mimeType?: string): FileKind {
  const extension = getExtension(fileName);
  const normalizedMimeType = String(mimeType || '').toLowerCase();

  if (extension && EXTENSION_KIND_MAP[extension]) {
    return EXTENSION_KIND_MAP[extension];
  }

  if (normalizedMimeType.startsWith('image/')) return 'image';
  if (normalizedMimeType.startsWith('video/')) return 'video';
  if (normalizedMimeType.includes('spreadsheet') || normalizedMimeType.includes('excel') || normalizedMimeType.includes('csv')) {
    return 'excel';
  }
  if (normalizedMimeType.includes('word') || normalizedMimeType.includes('document')) return 'word';
  if (normalizedMimeType.includes('powerpoint') || normalizedMimeType.includes('presentation')) return 'ppt';
  if (normalizedMimeType.includes('pdf')) return 'pdf';
  if (normalizedMimeType.includes('zip') || normalizedMimeType.includes('rar') || normalizedMimeType.includes('tar')) return 'zip';
  if (normalizedMimeType.includes('markdown')) return 'markdown';
  if (normalizedMimeType.startsWith('text/')) return 'text';

  return 'unknown';
}

export function getFileTypePresentation({ fileName, mimeType }: { fileName?: string; mimeType?: string }) {
  const kind = resolveFileKind(fileName, mimeType);
  return FILE_TYPE_PRESENTATIONS[kind];
}

interface FileTypeIconProps {
  fileName?: string;
  mimeType?: string;
  className?: string;
}

export default function FileTypeIcon({ fileName, mimeType, className }: FileTypeIconProps) {
  const presentation = getFileTypePresentation({ fileName, mimeType });
  const { Icon } = presentation;

  return (
    <span
      role="img"
      aria-label={presentation.ariaLabel}
      data-file-kind={presentation.kind}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-(--tf-border) text-(--tf-foreground)',
        className
      )}
      style={{
        color: presentation.color,
        backgroundColor: presentation.backgroundColor,
      }}
    >
      <Icon aria-hidden className="size-4" />
    </span>
  );
}
