type AllocationSeriesItem = {
  name?: unknown;
  data?: unknown;
};

export function formatAllocationPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return `${value.toFixed(2)}%`;
}

export function formatAllocationScaleYi(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '--';
  if (value >= 1000) return `${value.toFixed(0)}亿`;
  if (value >= 100) return `${value.toFixed(1)}亿`;
  return `${value.toFixed(2)}亿`;
}

export function resolveFundAllocationSnapshot(assetAllocation: Record<string, unknown> | null | undefined): Array<{label: string; value: string}> {
  const categories = Array.isArray(assetAllocation?.categories) ? assetAllocation.categories : [];
  const series = Array.isArray(assetAllocation?.series) ? assetAllocation.series : [];
  const latestIndex = categories.length > 0 ? categories.length - 1 : -1;
  if (latestIndex < 0) return [];

  const takeSeriesValue = (keyword: string): number | null => {
    const row = series.find((item) => {
      if (!item || typeof item !== 'object') return false;
      const name = typeof (item as AllocationSeriesItem).name === 'string' ? ((item as AllocationSeriesItem).name as string) : '';
      return name.includes(keyword);
    }) as AllocationSeriesItem | undefined;
    if (!row || !Array.isArray(row.data)) return null;
    const value = row.data[latestIndex];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };

  const netAssetYi = takeSeriesValue('净资产');
  return [
    {label: '股票占净比', value: formatAllocationPercent(takeSeriesValue('股票占净比'))},
    {label: '债券占净比', value: formatAllocationPercent(takeSeriesValue('债券占净比'))},
    {label: '现金占净比', value: formatAllocationPercent(takeSeriesValue('现金占净比'))},
    {label: '净资产', value: formatAllocationScaleYi(netAssetYi)},
  ].filter((item) => item.value !== '--');
}
