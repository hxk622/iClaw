export function startOfNextShanghaiDayIso(from = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(from);
  const year = Number(parts.find((item) => item.type === 'year')?.value || '1970');
  const month = Number(parts.find((item) => item.type === 'month')?.value || '01');
  const day = Number(parts.find((item) => item.type === 'day')?.value || '01');
  const nextUtc = Date.UTC(year, month - 1, day, 16, 0, 0, 0);
  return new Date(nextUtc).toISOString();
}
