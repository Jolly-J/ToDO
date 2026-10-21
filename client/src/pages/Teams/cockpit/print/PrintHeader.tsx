/**
 * 打印页头。
 * 文件作用：呈现团队名称、团队级别、打印时间与数据口径。
 */
interface PrintHeaderProps {
  teamName: string;
  teamLevelLabel?: string;
  printedAt: string;
  filterSummary: string;
}

export default function PrintHeader({ teamName, teamLevelLabel, printedAt, filterSummary }: PrintHeaderProps) {
  const subtitle = [teamLevelLabel, '团队驾驶舱'].filter(Boolean).join(' · ');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 24,
        paddingBottom: 14,
        borderBottom: '1px solid #EFEFEF',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            lineHeight: 1.25,
            color: '#37352F',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {teamName}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: '#787774' }}>{subtitle}</div>
      </div>
      <div
        style={{
          flexShrink: 0,
          textAlign: 'right',
          fontSize: 11,
          lineHeight: 1.7,
          color: '#9B9A97',
        }}
      >
        <div>打印时间：{printedAt}</div>
        <div>数据口径：{filterSummary}</div>
      </div>
    </div>
  );
}
