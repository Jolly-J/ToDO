/**
 * 打印区块标题。
 * 文件作用：统一打印页内各区块的标题与右侧说明。
 */
import type { ReactNode } from 'react';

interface PrintSectionTitleProps {
  title: string;
  meta?: ReactNode;
}

export default function PrintSectionTitle({ title, meta }: PrintSectionTitleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: '#37352F' }}>{title}</h3>
      {meta ? <span style={{ fontSize: 11, color: '#9B9A97' }}>{meta}</span> : null}
    </div>
  );
}
