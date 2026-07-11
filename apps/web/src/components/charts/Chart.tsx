import * as React from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { cn } from '../../lib/utils';

/**
 * Concrete hex palette for ECharts series (spec §30 — calm medical blue + teal).
 * ECharts renders to canvas, so it needs literal color values, never CSS
 * variables — these are hand-picked to sit on the same hue family as the
 * Tailwind design tokens in styles/tokens.css, but re-tuned per mode so the
 * chart marks clear the OKLCH lightness/contrast bands charts need (the UI
 * tokens are tuned for text contrast, a different constraint).
 */
export interface ChartPalette {
  primary: string;
  teal: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  axisLabel: string;
  axisLine: string;
  surface: string;
}

export const CHART_PALETTE: { light: ChartPalette; dark: ChartPalette } = {
  light: {
    primary: '#0f5c8c',
    teal: '#0d9488',
    success: '#16824f',
    warning: '#a16207',
    danger: '#be2a2a',
    info: '#1e6cb3',
    axisLabel: '#475569',
    axisLine: '#e2e8f0',
    surface: '#ffffff',
  },
  dark: {
    primary: '#2f83b0',
    teal: '#1f9c8f',
    success: '#4ac78d',
    warning: '#a97a1f',
    danger: '#eb6464',
    info: '#3a7fc9',
    axisLabel: '#94a3b8',
    axisLine: '#283447',
    surface: '#0f1724',
  },
};

function detectDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'dark') return true;
  if (explicit === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Tracks light/dark mode the same way styles/tokens.css resolves it (data-theme override, else OS preference). */
export function useChartPalette(): ChartPalette {
  const [isDark, setIsDark] = React.useState(detectDarkMode);

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setIsDark(detectDarkMode());
    media.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      media.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  return isDark ? CHART_PALETTE.dark : CHART_PALETTE.light;
}

interface SeriesDatum {
  name?: string;
  value?: unknown;
}

/** Best-effort fallback summary when the caller doesn't pass an explicit one. */
function deriveSummary(option: EChartsOption): string {
  const seriesOption = option.series;
  const seriesList = Array.isArray(seriesOption) ? seriesOption : seriesOption ? [seriesOption] : [];
  const parts: string[] = [];

  for (const series of seriesList) {
    const data = (series as { data?: unknown }).data;
    if (!Array.isArray(data)) continue;
    for (const point of data) {
      if (point && typeof point === 'object' && 'value' in point) {
        const datum = point as SeriesDatum;
        if (datum.name !== undefined) parts.push(`${datum.name}: ${String(datum.value)}`);
      } else if (typeof point === 'number' || typeof point === 'string') {
        parts.push(String(point));
      }
    }
  }

  return parts.length > 0 ? parts.join('; ') : 'No data available for this chart.';
}

export interface ChartProps {
  /** Full ECharts option object — this component only owns mount/resize/dispose lifecycle. */
  option: EChartsOption;
  /** Pixel height of the chart canvas. */
  height?: number;
  /** Accessible name for the chart, announced by screen readers (role="img"). */
  ariaLabel: string;
  /** Plain-text description of the underlying data, rendered visually hidden for screen readers. */
  summary?: string;
  className?: string;
}

/**
 * Thin Apache ECharts wrapper. Owns only the imperative init/resize/dispose
 * lifecycle — callers build the full `EChartsOption` (series, colors, tooltip)
 * themselves using `CHART_PALETTE` / `useChartPalette()` for literal colors.
 */
export function Chart({ option, height = 280, ariaLabel, summary, className }: ChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<echarts.ECharts | null>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const instance = echarts.init(containerRef.current);
    chartRef.current = instance;

    const handleResize = () => instance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      instance.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  const resolvedSummary = summary ?? deriveSummary(option);

  return (
    <div role="img" aria-label={ariaLabel} className={cn('w-full', className)} style={{ height }}>
      <div ref={containerRef} className="h-full w-full" aria-hidden="true" />
      <span className="sr-only">{resolvedSummary}</span>
    </div>
  );
}
