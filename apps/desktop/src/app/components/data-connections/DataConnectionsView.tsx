import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Database, Moon, Search, Shield, Sun } from 'lucide-react';
import {
  THEME_CHANGE_EVENT,
  applyThemeMode,
  getResolvedThemeFromDom,
  persistThemeMode,
  type ResolvedTheme,
} from '@/app/lib/theme';
import { capabilityGroups, type Capability } from './data-connections-data';

const markets = ['全部', 'A股', '美股', '港股', '期货', '黄金', '加密', '宏观', 'ETF/基金', '外汇'];
const statusFilters = ['全部', '已支持', '规划中'];

type Palette = {
  pageBg: string;
  cardBg: string;
  elevatedBg: string;
  hoverBg: string;
  primaryText: string;
  secondaryText: string;
  mutedText: string;
  subtleBorder: string;
  defaultBorder: string;
  strongBorder: string;
  brandGold: string;
  brandGoldStrong: string;
  brandGoldSoft: string;
};

const marketStyles: Record<string, { light: string; dark: string; lightBg: string; darkBg: string }> = {
  A股: {
    light: '#8B3A3A',
    dark: '#D89090',
    lightBg: 'rgba(139, 58, 58, 0.08)',
    darkBg: 'rgba(216, 144, 144, 0.12)',
  },
  美股: {
    light: '#4A6FA5',
    dark: '#8FA8D0',
    lightBg: 'rgba(74, 111, 165, 0.08)',
    darkBg: 'rgba(143, 168, 208, 0.12)',
  },
  港股: {
    light: '#4A8A7F',
    dark: '#7CB5AB',
    lightBg: 'rgba(74, 138, 127, 0.08)',
    darkBg: 'rgba(124, 181, 171, 0.12)',
  },
  期货: {
    light: '#A86F3E',
    dark: '#D39966',
    lightBg: 'rgba(168, 111, 62, 0.08)',
    darkBg: 'rgba(211, 153, 102, 0.12)',
  },
  黄金: {
    light: '#A88C5D',
    dark: '#C2AA82',
    lightBg: 'rgba(168, 140, 93, 0.08)',
    darkBg: 'rgba(194, 170, 130, 0.12)',
  },
  加密: {
    light: '#4A8A6F',
    dark: '#7CB59C',
    lightBg: 'rgba(74, 138, 111, 0.08)',
    darkBg: 'rgba(124, 181, 156, 0.12)',
  },
  宏观: {
    light: '#6B655D',
    dark: '#B9B0A5',
    lightBg: 'rgba(107, 101, 93, 0.08)',
    darkBg: 'rgba(185, 176, 165, 0.12)',
  },
  'ETF/基金': {
    light: '#5A6B9F',
    dark: '#8B9AC9',
    lightBg: 'rgba(90, 107, 159, 0.08)',
    darkBg: 'rgba(139, 154, 201, 0.12)',
  },
  外汇: {
    light: '#4A7A9F',
    dark: '#7AACD0',
    lightBg: 'rgba(74, 122, 159, 0.08)',
    darkBg: 'rgba(122, 172, 208, 0.12)',
  },
};

function paletteForTheme(theme: ResolvedTheme): Palette {
  return theme === 'light'
    ? {
        pageBg: '#F7F5F0',
        cardBg: '#FCFBF8',
        elevatedBg: '#FFFFFF',
        hoverBg: '#F1EEE8',
        primaryText: '#1A1A18',
        secondaryText: '#6B655D',
        mutedText: '#9A9288',
        subtleBorder: '#ECE7DE',
        defaultBorder: '#DED7CC',
        strongBorder: '#C8BEAF',
        brandGold: '#A88C5D',
        brandGoldStrong: '#8F7751',
        brandGoldSoft: '#EAE1D0',
      }
    : {
        pageBg: '#11100F',
        cardBg: '#191715',
        elevatedBg: '#211E1B',
        hoverBg: '#26221F',
        primaryText: '#F2EEE6',
        secondaryText: '#B9B0A5',
        mutedText: '#80786E',
        subtleBorder: '#2A2622',
        defaultBorder: '#3A342E',
        strongBorder: '#534A42',
        brandGold: '#B49A70',
        brandGoldStrong: '#C2AA82',
        brandGoldSoft: 'rgba(180,154,112,0.16)',
      };
}

function MarketChip({
  market,
  selected,
  onClick,
  theme,
  colors,
}: {
  market: string;
  selected: boolean;
  onClick: () => void;
  theme: ResolvedTheme;
  colors: Palette;
}) {
  const style = marketStyles[market];
  const isAll = market === '全部';

  if (isAll || !style) {
    return (
      <button
        onClick={onClick}
        className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-all hover:scale-105 active:scale-[0.98]"
        style={{
          backgroundColor: selected ? colors.brandGoldSoft : colors.elevatedBg,
          borderColor: selected ? colors.brandGold : colors.defaultBorder,
          color: selected ? colors.brandGoldStrong : colors.secondaryText,
        }}
      >
        {market}
      </button>
    );
  }

  const textColor = theme === 'light' ? style.light : style.dark;
  const bgColor = theme === 'light' ? style.lightBg : style.darkBg;

  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-all hover:scale-105 active:scale-[0.98]"
      style={{
        backgroundColor: selected ? bgColor : colors.elevatedBg,
        borderColor: selected ? textColor : colors.defaultBorder,
        color: selected ? textColor : colors.secondaryText,
      }}
    >
      {market}
    </button>
  );
}

function CapabilityCard({
  capability,
  theme,
  colors,
}: {
  capability: Capability & { category: string; categoryDesc: string };
  theme: ResolvedTheme;
  colors: Palette;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group cursor-pointer rounded-2xl border p-6 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
      style={{
        backgroundColor: colors.cardBg,
        borderColor: isHovered ? colors.brandGold : colors.subtleBorder,
        boxShadow: isHovered ? `0 12px 32px -8px ${colors.brandGoldSoft}` : 'none',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span
          className="rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: colors.brandGoldSoft,
            color: colors.brandGoldStrong,
          }}
        >
          {capability.category}
        </span>
        {capability.status && (
          <span
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
            style={{
              backgroundColor: colors.hoverBg,
              color: colors.brandGold,
            }}
          >
            <Shield className="h-3 w-3" />
            {capability.status}
          </span>
        )}
      </div>

      <h3
        className="mb-2 text-xl font-semibold tracking-tight"
        style={{ color: colors.primaryText }}
      >
        {capability.title}
      </h3>

      <p
        className="mb-5 text-sm leading-relaxed"
        style={{ color: colors.secondaryText }}
      >
        {capability.subtitle}
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {capability.capabilities.map((cap, index) => (
          <span
            key={index}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all group-hover:scale-105"
            style={{
              backgroundColor: colors.elevatedBg,
              color: colors.secondaryText,
              borderColor: colors.defaultBorder,
            }}
          >
            {cap}
          </span>
        ))}
      </div>

      <div className="border-t pt-4" style={{ borderColor: colors.subtleBorder }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium" style={{ color: colors.mutedText }}>
            支持市场:
          </span>
          {capability.markets.map((market, index) => {
            const marketStyle = marketStyles[market];
            const textColor = marketStyle
              ? theme === 'light'
                ? marketStyle.light
                : marketStyle.dark
              : colors.primaryText;
            return (
              <span
                key={index}
                className="rounded px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor: colors.hoverBg,
                  color: textColor,
                }}
              >
                {market}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="text-xs font-medium" style={{ color: colors.brandGold }}>
          查看详情
        </span>
        <ChevronRight
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
          style={{ color: colors.brandGold }}
        />
      </div>
    </div>
  );
}

export function DataConnectionsView() {
  const [theme, setTheme] = useState<ResolvedTheme>(() => getResolvedThemeFromDom());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['全部']);
  const [selectedStatus, setSelectedStatus] = useState('全部');

  useEffect(() => {
    const handleThemeChange = () => setTheme(getResolvedThemeFromDom());
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  }, []);

  const colors = paletteForTheme(theme);

  const allCapabilities = useMemo(() => {
    const flattened: Array<Capability & { category: string; categoryDesc: string }> = [];
    capabilityGroups.forEach((group) => {
      group.items.forEach((item) => {
        flattened.push({
          ...item,
          category: group.title,
          categoryDesc: group.description,
        });
      });
    });
    return flattened;
  }, []);

  const filteredCapabilities = useMemo(
    () =>
      allCapabilities.filter((capability) => {
        const matchesSearch =
          searchQuery === '' ||
          capability.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          capability.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          capability.capabilities.some((item) => item.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesMarket =
          selectedMarkets.includes('全部') ||
          capability.markets.some((market) => selectedMarkets.includes(market));

        const matchesStatus = selectedStatus === '全部' || capability.status === selectedStatus;

        return matchesSearch && matchesMarket && matchesStatus;
      }),
    [allCapabilities, searchQuery, selectedMarkets, selectedStatus],
  );

  const handleMarketToggle = (market: string) => {
    if (market === '全部') {
      setSelectedMarkets(['全部']);
      return;
    }

    let nextSelected = selectedMarkets.filter((item) => item !== '全部');
    if (nextSelected.includes(market)) {
      nextSelected = nextSelected.filter((item) => item !== market);
      if (nextSelected.length === 0) nextSelected = ['全部'];
    } else {
      nextSelected = [...nextSelected, market];
    }
    setSelectedMarkets(nextSelected);
  };

  const handleThemeToggle = () => {
    const nextMode = theme === 'light' ? 'dark' : 'light';
    persistThemeMode(nextMode);
    applyThemeMode(nextMode);
    setTheme(nextMode);
  };

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 overflow-y-auto transition-colors duration-300"
      style={{ backgroundColor: colors.pageBg }}
    >
      <div className="mx-auto w-full max-w-[1600px] px-8 py-8">
        <div
          className="mb-8 rounded-2xl border px-10 py-8 transition-colors"
          style={{
            backgroundColor: colors.cardBg,
            borderColor: colors.subtleBorder,
          }}
        >
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h1
                className="mb-3 text-4xl font-semibold tracking-tight"
                style={{ color: colors.primaryText }}
              >
                数据连接中心
              </h1>
              <p
                className="mb-6 max-w-3xl text-base leading-relaxed"
                style={{ color: colors.secondaryText }}
              >
                iClaw 金融数据能力封装层 · 覆盖全球多市场行情、财报、资讯、宏观与加密资产数据集
              </p>

              <div className="flex items-center gap-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold" style={{ color: colors.brandGold }}>
                    {allCapabilities.length}
                  </span>
                  <span className="text-sm font-medium" style={{ color: colors.mutedText }}>
                    数据能力
                  </span>
                </div>
                <div className="h-8 w-px" style={{ backgroundColor: colors.defaultBorder }} />
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold" style={{ color: colors.brandGold }}>
                    9
                  </span>
                  <span className="text-sm font-medium" style={{ color: colors.mutedText }}>
                    接入市场
                  </span>
                </div>
                <div className="h-8 w-px" style={{ backgroundColor: colors.defaultBorder }} />
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold" style={{ color: colors.brandGold }}>
                    {capabilityGroups.length}
                  </span>
                  <span className="text-sm font-medium" style={{ color: colors.mutedText }}>
                    能力类别
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleThemeToggle}
              className="cursor-pointer rounded-xl border p-3 transition-all hover:scale-105 active:scale-[0.98]"
              style={{
                backgroundColor: colors.elevatedBg,
                borderColor: colors.defaultBorder,
              }}
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5" style={{ color: colors.secondaryText }} />
              ) : (
                <Sun className="h-5 w-5" style={{ color: colors.secondaryText }} />
              )}
            </button>
          </div>
        </div>

        <div
          className="mb-8 rounded-2xl border px-8 py-5"
          style={{
            backgroundColor: colors.cardBg,
            borderColor: colors.subtleBorder,
          }}
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-[320px] flex-1">
              <div className="relative">
                <Search
                  className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                  style={{ color: colors.mutedText }}
                />
                <input
                  type="text"
                  placeholder='搜索能力，例如"实时行情""财务报表""宏观数据"'
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-xl border py-3 pl-12 pr-4 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: colors.elevatedBg,
                    borderColor: colors.defaultBorder,
                    color: colors.primaryText,
                    boxShadow: 'none',
                  }}
                  onFocus={(event) => {
                    event.target.style.borderColor = colors.brandGold;
                    event.target.style.boxShadow = `0 0 0 3px ${colors.brandGoldSoft}`;
                  }}
                  onBlur={(event) => {
                    event.target.style.borderColor = colors.defaultBorder;
                    event.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {markets.map((market) => (
                <MarketChip
                  key={market}
                  market={market}
                  selected={selectedMarkets.includes(market)}
                  onClick={() => handleMarketToggle(market)}
                  theme={theme}
                  colors={colors}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {statusFilters.map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className="cursor-pointer rounded-lg border px-4 py-2 text-xs font-medium transition-all hover:scale-105 active:scale-[0.98]"
                  style={{
                    backgroundColor: selectedStatus === status ? colors.brandGoldSoft : colors.elevatedBg,
                    borderColor: selectedStatus === status ? colors.brandGold : colors.defaultBorder,
                    color: selectedStatus === status ? colors.brandGoldStrong : colors.secondaryText,
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCapabilities.map((capability, index) => (
            <CapabilityCard
              key={`${capability.category}-${capability.title}-${index}`}
              capability={capability}
              theme={theme}
              colors={colors}
            />
          ))}
        </div>

        {filteredCapabilities.length === 0 && (
          <div
            className="rounded-2xl border p-16 text-center"
            style={{
              backgroundColor: colors.cardBg,
              borderColor: colors.subtleBorder,
            }}
          >
            <Database className="mx-auto mb-4 h-16 w-16" style={{ color: colors.mutedText }} />
            <h3
              className="mb-2 text-lg font-semibold"
              style={{ color: colors.primaryText }}
            >
              未找到匹配的能力
            </h3>
            <p className="text-sm" style={{ color: colors.secondaryText }}>
              请尝试调整搜索条件或筛选器
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
