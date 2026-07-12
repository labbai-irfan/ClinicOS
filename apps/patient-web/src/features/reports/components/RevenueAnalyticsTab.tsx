import { useMemo } from 'react';
import type { EChartsOption, TooltipComponentFormatterCallbackParams } from 'echarts';
import { PAYMENT_METHODS } from '@clinicos/types';
import type { PaymentMethod } from '@clinicos/types';
import { formatMoney } from '@clinicos/config';
import { Card } from '../../../components/ui/Card';
import { Chart, useChartPalette } from '../../../components/charts/Chart';
import { AnalyticsSection } from './AnalyticsSection';
import { formatAxisDate, PAYMENT_METHOD_LABELS } from '../utils';
import { useRevenueAnalyticsQuery, type AnalyticsDateRange, type RevenueAnalyticsDto } from '../api';

function amountByMethod(rows: RevenueAnalyticsDto['byPaymentMethod']): Record<PaymentMethod, number> {
  const totals: Record<PaymentMethod, number> = { cash: 0, upi: 0, card: 0, bank_transfer: 0 };
  for (const row of rows) {
    if (row.method in totals) totals[row.method] += row.amountPaise;
  }
  return totals;
}

function axisTooltipFormatter(params: TooltipComponentFormatterCallbackParams): string {
  const list = Array.isArray(params) ? params : [params];
  return list.map((p) => `${p.name}: ${formatMoney(Math.round(Number(p.value) * 100))}`).join('<br/>');
}

function DailyRevenueChart({ data }: { data: RevenueAnalyticsDto }) {
  const palette = useChartPalette();
  const points = data.dailyRevenue;

  const option: EChartsOption = useMemo(
    () => ({
      grid: { left: 72, right: 16, top: 24, bottom: 32, containLabel: true },
      tooltip: { trigger: 'axis', formatter: axisTooltipFormatter },
      xAxis: {
        type: 'category',
        data: points.map((p) => formatAxisDate(p.date)),
        axisLine: { lineStyle: { color: palette.axisLine } },
        axisLabel: { color: palette.axisLabel },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: palette.axisLine } },
        axisLabel: { color: palette.axisLabel, formatter: (value: number) => formatMoney(Math.round(value * 100)) },
        splitLine: { lineStyle: { color: palette.axisLine } },
      },
      series: [
        {
          type: 'line',
          name: 'Revenue',
          data: points.map((p) => p.revenuePaise / 100),
          smooth: true,
          itemStyle: { color: palette.primary },
          lineStyle: { color: palette.primary, width: 2 },
          areaStyle: { color: palette.primary, opacity: 0.12 },
        },
      ],
    }),
    [points, palette],
  );

  const total = points.reduce((sum, p) => sum + p.revenuePaise, 0);
  const summary = `Total revenue: ${formatMoney(total)} across ${points.length} days.`;

  return (
    <>
      <p className="mb-2 text-sm text-text-secondary">
        Total in range: <span className="font-medium text-text-primary">{formatMoney(total)}</span>
      </p>
      <Chart option={option} height={280} ariaLabel="Line chart of daily revenue over time" summary={summary} />
    </>
  );
}

function PaymentMethodChart({ data }: { data: RevenueAnalyticsDto }) {
  const palette = useChartPalette();
  const totals = useMemo(() => amountByMethod(data.byPaymentMethod), [data.byPaymentMethod]);

  const option: EChartsOption = useMemo(
    () => ({
      grid: { left: 110, right: 24, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: axisTooltipFormatter },
      xAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: palette.axisLine } },
        axisLabel: { color: palette.axisLabel, formatter: (value: number) => formatMoney(Math.round(value * 100)) },
        splitLine: { lineStyle: { color: palette.axisLine } },
      },
      yAxis: {
        type: 'category',
        data: PAYMENT_METHODS.map((method) => PAYMENT_METHOD_LABELS[method]),
        axisLine: { lineStyle: { color: palette.axisLine } },
        axisLabel: { color: palette.axisLabel },
      },
      series: [
        {
          type: 'bar',
          name: 'Collected',
          data: PAYMENT_METHODS.map((method) => totals[method] / 100),
          barMaxWidth: 28,
          itemStyle: { color: palette.teal, borderRadius: [0, 4, 4, 0] },
        },
      ],
    }),
    [totals, palette],
  );

  const summary = PAYMENT_METHODS.map((method) => `${PAYMENT_METHOD_LABELS[method]}: ${formatMoney(totals[method])}`).join(
    '; ',
  );

  return (
    <Chart option={option} height={240} ariaLabel="Bar chart of revenue collected by payment method" summary={summary} />
  );
}

export function RevenueAnalyticsTab({ range }: { range: AnalyticsDateRange }) {
  const query = useRevenueAnalyticsQuery(range);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="min-w-0 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-text-primary">Daily Revenue Trend</h3>
        <div className="mt-3">
          <AnalyticsSection
            isLoading={query.isLoading}
            isError={query.isError}
            data={query.data}
            isEmpty={(data) => data.dailyRevenue.length === 0}
          >
            {(data) => <DailyRevenueChart data={data} />}
          </AnalyticsSection>
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          Total amount collected each day across all invoices in the selected range.
        </p>
      </Card>

      <Card className="min-w-0 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-text-primary">Revenue by Payment Method</h3>
        <div className="mt-3">
          <AnalyticsSection
            isLoading={query.isLoading}
            isError={query.isError}
            data={query.data}
            isEmpty={(data) => data.byPaymentMethod.length === 0}
          >
            {(data) => <PaymentMethodChart data={data} />}
          </AnalyticsSection>
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          How collected revenue splits across cash, UPI, card and bank transfer in the selected range.
        </p>
      </Card>
    </div>
  );
}
