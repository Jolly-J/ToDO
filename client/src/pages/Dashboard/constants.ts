export const TIME_RANGE_MAP: Record<string, number | undefined> = {
  all: undefined,
  week: 7,
  month: 30,
  year: 365,
};

export const TIME_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];
