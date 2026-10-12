/**
 * 组件名称：详情页只读信息分区组件
 * 文件作用：统一任务/团队等详情页在只读模式下的信息层级展示。
 * 主要功能：提供纯字段分组、网格和标签值布局，不引入解释性文案。
 */
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './DetailReadonly.module.css';

type ReadonlyColumnCount = 1 | 2 | 3;

interface DetailReadonlyStackProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface DetailReadonlyGroupProps extends HTMLAttributes<HTMLElement> {
  columns?: ReadonlyColumnCount;
  children: ReactNode;
  contentClassName?: string;
}

interface DetailReadonlyFieldProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  children: ReactNode;
  valueClassName?: string;
}

const columnClassMap: Record<ReadonlyColumnCount, string> = {
  1: styles.columns1,
  2: styles.columns2,
  3: styles.columns3,
};

function cx(...classNames: Array<string | undefined | false>) {
  return classNames.filter(Boolean).join(' ');
}

export function DetailReadonlyStack({ className, children, ...rest }: DetailReadonlyStackProps) {
  return (
    <div className={cx(styles.stack, className)} {...rest}>
      {children}
    </div>
  );
}

export function DetailReadonlyGroup({
  columns = 1,
  className,
  contentClassName,
  children,
  ...rest
}: DetailReadonlyGroupProps) {
  return (
    <section className={cx(styles.group, className)} {...rest}>
      <div className={cx(styles.sectionContent, columnClassMap[columns], contentClassName)}>{children}</div>
    </section>
  );
}

export function DetailReadonlyField({
  label,
  children,
  className,
  valueClassName,
  ...rest
}: DetailReadonlyFieldProps) {
  return (
    <div className={cx(styles.field, className)} {...rest}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={cx(styles.fieldValue, valueClassName)}>{children}</div>
    </div>
  );
}
