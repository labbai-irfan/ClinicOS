import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EMERGENCY_PRIORITIES } from '@clinicos/types';
import type { EmergencyPriority } from '@clinicos/types';
import { Card } from '../../../components/ui/Card';
import { Chart, useChartPalette, type ChartPalette } from '../../../components/charts/Chart';
import { AnalyticsSection } from './AnalyticsSection';
import { formatAxisDate, titleCase } from '../utils';
import { useEmergencyAnalyticsQuery, type AnalyticsDateRange, type EmergencyAnalyticsDto } from '../api';

function countByPriority(rows: EmergencyAnalyticsDto['priorityDistribution']): Record<EmergencyPriority, number> {
  const totals: Record<EmergencyPriority, number> = { critical: 0, urgent: 0, standard: 0, unconfirmed: 0 };
  for (const row of rows) {
    if (row.priority in totals) totals[row.priority] += row.count;
  }
  return totals;
}

function priorityColor(palette: ChartPalette, priority: EmergencyPriority): string {
  switch (priority) {
    case 'critical':
      return palette.danger;
    case 'urgent':
      return palette.warning;
    case 'standard':
      return palette.info;
    default:
      return palette.axisLabel;
  }
}

function VolumeTrendChart({ data }: { data: EmergencyAnalyticsDto }) {
  const palette = useChartPalette();
  const points = data.volumeSeries;

  const option: EChartsOption = useMemo(
    () => ({
      grid: { left: 48, right: 16, top: 24, bottom: 32, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: points.map((p) => formatAxisDate(p.date)),
        axisLine: { lineStyle: { color: palette.axisLine } },
        axisLabel: { color: palette.axisLabel },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLine: { lineStyle: { color: palette.axisLine } },
        axisLabel: { color: palette.axisLabel },
        splitLine: { lineStyle: { color: palette.axisLine } },
      },
      series: [
        {
          type: 'line',
          name: 'Emergency cases',
          data: points.map((p) => p.count),
          smooth: true,
          itemStyle: { color: palette.danger },
          lineStyle: { color: palette.danger, width: 2 },
          areaStyle: { color: palette.danger, opacity: 0.12 },
        },
      ],
    }),
    [points, palette],
  );

  const total = points.reduce((sum, p) => sum + p.count, 0);
  const summary = `${total} emergency cases across ${points.length} days.`;

  return (
    <Chart option={option} height={280} ariaLabel="Line chart of emergency case volume over time" summary={summary} />
  );
}

function PriorityDistributionChart({ data }: { data: EmergencyAnalyticsDto }) {
  const palette = useChartPalette();
  const totals = useMemo(() => countByPriority(data.priorityDistribution), [data.priorityDistribution]);

  const option: EChartsOption = useMemo(
    () => ({
      grid: { left: 110, right: 24, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLine: { lineStyle: { color: palette.axisLine } },
        axisLabel: { color: palette.axisLabel },
        splitLine: { lineStyle: { color: palette.axisLine } },
      },
      yAxis: {
        type: 'category',
        data: EMERGENCY_PRIORITIES.map((p) => titleCase(p)),
        axisLine: { lineStyle: { color: palette.axisLine } },
        axisLabel: { color: palette.axisLabel },
      },
      series: [
        {
          type: 'bar',
          name: 'Cases',
          data: EMERGENCY_PRIORITIES.map((priority) => ({
            value: totals[priority],
            itemStyle: { color: priorityColor(palette, priority), borderRadius: [0, 4, 4, 0] },
          })),
          barMaxWidth: 28,
        },
      ],
    }),
    [totals, palette],
  );

  const summary = EMERGENCY_PRIORITIES.map((p) => `${titleCase(p)}: ${totals[p]}`).join('; ');

  return (
    <Chart option={option} height={220} ariaLabel="Bar chart of emergency cases by priority" summary={summary} />
  );
}

export function EmergencyAnalyticsTab({ range }: { range: AnalyticsDateRange }) {
  const query = useEmergencyAnalyticsQuery(range);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="min-w-0 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-text-primary">Emergency Case Volume</h3>
        <div className="mt-3">
          <AnalyticsSection
            isLoading={query.isLoading}
            isError={query.isError}
            data={query.data}
            isEmpty={(data) => data.volumeSeries.length === 0}
          >
            {(data) => <VolumeTrendChart data={data} />}
          </AnalyticsSection>
        </div>
        <p className="mt-2 text-xs text-text-secondary">Number of emergency cases opened each day in the selected range.</p>
      </Card>

      <Card className="min-w-0 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-text-primary">Priority Distribution</h3>
        <div className="mt-3">
          <AnalyticsSection
            isLoading={query.isLoading}
            isError={query.isError}
            data={query.data}
            isEmpty={(data) => data.priorityDistribution.length === 0}
          >
            {(data) => <PriorityDistributionChart data={data} />}
          </AnalyticsSection>
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          How emergency cases in the selected range split across assigned priority.
        </p>
      </Card>
    </div>
  );
}
