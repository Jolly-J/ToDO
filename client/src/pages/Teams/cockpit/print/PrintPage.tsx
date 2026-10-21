/**
 * 打印纸张容器。
 * 文件作用：承载单页打印内容，宽度固定为 A4 横向宽，高度随内容自适应。
 */
import type { ReactNode, Ref } from 'react';
import { PRINT_PAGE_PADDING_PX, PRINT_PAGE_WIDTH_PX } from './printLayout';

interface PrintPageProps {
  pageRef?: Ref<HTMLDivElement>;
  pageNo: number;
  totalPages: number;
  footerLeft: string;
  children: ReactNode;
}

export default function PrintPage({
  pageRef,
  pageNo,
  totalPages,
  footerLeft,
  children,
}: PrintPageProps) {
  return (
    <div
      ref={pageRef}
      data-print-page={pageNo}
      style={{
        width: PRINT_PAGE_WIDTH_PX,
        boxSizing: 'border-box',
        padding: PRINT_PAGE_PADDING_PX,
        background: '#FFFFFF',
        color: '#37352F',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {children}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #EFEFEF',
          paddingTop: 10,
          fontSize: 11,
          color: '#9B9A97',
        }}
      >
        <span>{footerLeft}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          第 {pageNo} 页 / 共 {totalPages} 页
        </span>
      </div>
    </div>
  );
}
