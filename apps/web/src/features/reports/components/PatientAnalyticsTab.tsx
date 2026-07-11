import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { Card } from '../../../components/ui/Card';
import { Chart, useChartPalette } from '../../../components/charts/Chart';
import { AnalyticsSection } from './AnalyticsSection';
import { formatAxisDate } from '../utils';
import { usePatientAnalyticsQuery, type AnalyticsDateRange, type PatientAnalyticsDto } from '../api';

function PatientTrendChart({ data }: { data: PatientAnalyticsDto }) {
  const palette = useChartPalette();
  const points = data.series;

  const option: EChartsOption = useMemo(
    () => ({
      grid: { left: 48, right: 16, top: 32, bottom: 32, containLabel: true },
      legend: { top: 0, textStyle: { color: palette.axisLabel } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
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
          type: 'bar',
          name: 'New patients',
          stack: 'patients',
          data: points.map((p) => p.newPatients),
          itemStyle: { color: palette.primary },
        },
        {
          type: 'bar',
          name: 'Returning patients',
          stack: 'patients',
          data: points.map((p) => p.returningPatients),
          itemStyle: { color: palette.teal },
        },
      ],
    }),
    [points, palette],
  );

  const totalNew = points.reduce((sum, p) => sum + p.newPatients, 0);
  const totalReturning = points.reduce((sum, p) => sum + p.returningPatients, 0);
  const summary = `New patients: ${totalNew} total. Returning patients: ${totalReturning} total. Across ${points.length} days.`;

  return (
    <Chart
      option={option}
      height={300}
      ariaLabel="Stacked bar chart of new versus returning patients over time"
      summary={summary}
    />
  );
}

export function PatientAnalyticsTab({ range }: { range: AnalyticsDateRange }) {
  const query = usePatientAnalyticsQuery(range);

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <h3 className="text-base font-semibold text-text-primary">New vs. Returning Patients</h3>
      <div className="mt-3">
        <AnalyticsSection
          isLoading={query.isLoading}
          isError={query.isError}
          data={query.data}
          isEmpty={(data) => data.series.length === 0}
        >
          {(data) => <PatientTrendChart data={data} />}
        </AnalyticsSection>
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        Daily count of new patients (first visit) versus returning patients (repeat visit) across the selected date
        range.
      </p>
    </Card>
  );
}
